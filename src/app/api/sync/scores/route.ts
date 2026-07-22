import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { oddsApi, DEFAULT_SYNC_SPORT_KEYS } from "@/lib/odds-api/client";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type SelectionRow = {
  id: string;
  bet_id: string;
  market_id: string;
  selection_name: string;
};

export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const keysParam = req.nextUrl.searchParams.get("keys");
  const keys = keysParam ? keysParam.split(",") : DEFAULT_SYNC_SPORT_KEYS;

  const summary: Record<string, unknown> = {};
  let settledBets = 0;

  for (const key of keys) {
    let scoreEvents;
    try {
      scoreEvents = await oddsApi.getScores(key);
    } catch (e) {
      summary[key] = `fetch failed: ${(e as Error).message}`;
      continue;
    }

    let finished = 0;
    for (const ev of scoreEvents) {
      if (!ev.completed || !ev.scores) continue;

      const { data: fixture } = await supabase
        .from("fixtures")
        .select("id, status, home_team, away_team")
        .eq("odds_api_event_id", ev.id)
        .maybeSingle();
      if (!fixture || fixture.status === "finished") continue;

      const homeScore = Number(ev.scores.find((s) => s.name === fixture.home_team)?.score ?? NaN);
      const awayScore = Number(ev.scores.find((s) => s.name === fixture.away_team)?.score ?? NaN);
      if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) continue;

      await supabase
        .from("fixtures")
        .update({ status: "finished", home_score: homeScore, away_score: awayScore })
        .eq("id", fixture.id);

      const { data: markets } = await supabase
        .from("markets")
        .select("id, market_key")
        .eq("fixture_id", fixture.id);

      const winnerName =
        homeScore > awayScore ? fixture.home_team : awayScore > homeScore ? fixture.away_team : "Draw";
      const total = homeScore + awayScore;

      for (const market of markets ?? []) {
        const { data: outcomes } = await supabase
          .from("odds_outcomes")
          .select("id, name, point")
          .eq("market_id", market.id);

        const { data: pendingSelections } = await supabase
          .from("bet_selections")
          .select("id, bet_id, market_id, selection_name")
          .eq("market_id", market.id)
          .eq("status", "pending");

        for (const sel of (pendingSelections ?? []) as SelectionRow[]) {
          let status: "won" | "lost" | "void" = "lost";

          if (market.market_key === "h2h") {
            status = sel.selection_name === winnerName ? "won" : "lost";
          } else if (market.market_key === "totals") {
            const outcome = outcomes?.find((o) => o.name === sel.selection_name);
            const point = outcome?.point ?? null;
            if (point === null) {
              status = "void";
            } else if (total === point) {
              status = "void";
            } else if (sel.selection_name === "Over") {
              status = total > point ? "won" : "lost";
            } else if (sel.selection_name === "Under") {
              status = total < point ? "won" : "lost";
            }
          }

          await supabase
            .from("bet_selections")
            .update({ status, settled_at: new Date().toISOString() })
            .eq("id", sel.id);
        }

        await supabase.from("markets").update({ status: "closed" }).eq("id", market.id);
      }

      finished++;
    }
    summary[key] = finished;
  }

  // Settle any bet whose every selection now has a final status.
  const { data: openBets } = await supabase.from("bets").select("id").eq("status", "open");
  for (const bet of openBets ?? []) {
    const { data: selections } = await supabase
      .from("bet_selections")
      .select("status")
      .eq("bet_id", bet.id);
    const allResolved = (selections ?? []).every((s) => s.status !== "pending");
    if (!allResolved || !selections?.length) continue;

    const { error } = await supabase.rpc("fn_settle_bet", { p_bet_id: bet.id });
    if (!error) settledBets++;
  }

  return NextResponse.json({ finished: summary, settledBets });
}
