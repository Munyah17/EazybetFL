import type { SupabaseClient } from "@supabase/supabase-js";
import { oddsApi } from "@/lib/odds-api/client";
import { logError } from "@/lib/log";
import { settleResolvedBets } from "@/lib/sync/settle";
import type { Database } from "@/types/database";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

type SelectionRow = {
  id: string;
  bet_id: string;
  market_id: string;
  selection_name: string;
};

export async function syncScores(
  supabase: SupabaseClient<Database>,
  keysParam?: string | null
): Promise<Result<{ finished: Record<string, unknown>; settledBets: number }>> {
  // Same default as syncOdds: every competition currently marked `active`,
  // not a hardcoded list -- otherwise bets on a competition that came
  // into season after the list was last updated would never settle.
  let keys: string[];
  if (keysParam) {
    keys = keysParam.split(",");
  } else {
    // Same priority ordering as syncOdds -- if quota runs out mid-run,
    // it's low-priority sports' bets that stay unsettled longer, not
    // football's.
    type Row = { odds_api_key: string; display_order: number; sport_groups: { display_order: number } | null };
    const { data, error } = await supabase
      .from("competitions")
      .select("odds_api_key, display_order, sport_groups ( display_order )")
      .eq("active", true);
    if (error) return { ok: false, error: error.message, status: 500 };
    const rows = (data ?? []) as unknown as Row[];
    rows.sort((a, b) => {
      const groupDiff = (a.sport_groups?.display_order ?? 999) - (b.sport_groups?.display_order ?? 999);
      return groupDiff !== 0 ? groupDiff : a.display_order - b.display_order;
    });
    keys = rows.map((c) => c.odds_api_key);
  }

  const summary: Record<string, unknown> = {};
  let settledBets = 0;

  for (const key of keys) {
    let scoreEvents;
    try {
      scoreEvents = await oddsApi.getScores(key);
    } catch (e) {
      summary[key] = `fetch failed: ${(e as Error).message}`;
      await logError("sync:scores", e, { key, step: "fetch" });
      continue;
    }

    let finished = 0;
    for (const ev of scoreEvents) {
      if (!ev.completed || !ev.scores) continue;

      // Every step below can throw (any Supabase error is turned into a
      // throw) -- one fixture failing to settle must not stop the rest of
      // this key's events, and must not be swallowed silently: it's logged
      // and simply not marked "finished" below, so the next run picks it
      // back up automatically (see the removed `fixture.status ===
      // "finished"` skip that used to make a partial failure permanent).
      try {
        const { data: fixture, error: fixtureErr } = await supabase
          .from("fixtures")
          .select("id, status, home_team, away_team")
          .eq("odds_api_event_id", ev.id)
          .maybeSingle();
        if (fixtureErr) throw new Error(`fixture lookup failed: ${fixtureErr.message}`);
        if (!fixture) continue; // not a fixture we track

        const homeScore = Number(ev.scores.find((s) => s.name === fixture.home_team)?.score ?? NaN);
        const awayScore = Number(ev.scores.find((s) => s.name === fixture.away_team)?.score ?? NaN);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) continue;

        const { data: markets, error: marketsErr } = await supabase
          .from("markets")
          .select("id, market_key")
          .eq("fixture_id", fixture.id);
        if (marketsErr) throw new Error(`markets lookup failed: ${marketsErr.message}`);

        const winnerName =
          homeScore > awayScore ? fixture.home_team : awayScore > homeScore ? fixture.away_team : "Draw";
        const total = homeScore + awayScore;

        for (const market of markets ?? []) {
          const { data: outcomes, error: outcomesErr } = await supabase
            .from("odds_outcomes")
            .select("id, name, point")
            .eq("market_id", market.id);
          if (outcomesErr) throw new Error(`outcomes lookup failed (market ${market.id}): ${outcomesErr.message}`);

          const { data: pendingSelections, error: selErr } = await supabase
            .from("bet_selections")
            .select("id, bet_id, market_id, selection_name")
            .eq("market_id", market.id)
            .eq("status", "pending");
          if (selErr) throw new Error(`selections lookup failed (market ${market.id}): ${selErr.message}`);

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

            const { error: updateSelErr } = await supabase
              .from("bet_selections")
              .update({ status, settled_at: new Date().toISOString() })
              .eq("id", sel.id);
            if (updateSelErr) throw new Error(`selection update failed (${sel.id}): ${updateSelErr.message}`);
          }

          const { error: closeMarketErr } = await supabase
            .from("markets")
            .update({ status: "closed" })
            .eq("id", market.id);
          if (closeMarketErr) throw new Error(`market close failed (${market.id}): ${closeMarketErr.message}`);
        }

        // Flip to "finished" only once every market's selections above
        // actually settled -- if anything threw, this is skipped, and the
        // fixture stays eligible for retry on the next run.
        const { error: finishErr } = await supabase
          .from("fixtures")
          .update({ status: "finished", home_score: homeScore, away_score: awayScore })
          .eq("id", fixture.id);
        if (finishErr) throw new Error(`fixture finish update failed: ${finishErr.message}`);

        finished++;
      } catch (e) {
        await logError("sync:scores", e, { key, eventId: ev.id });
      }
    }
    summary[key] = finished;
  }

  // Settle any bet whose every selection now has a final status.
  const settleResult = await settleResolvedBets(supabase);
  settledBets = settleResult.settled;

  return { ok: true, data: { finished: summary, settledBets } };
}
