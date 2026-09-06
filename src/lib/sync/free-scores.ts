import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecentFinalScores, teamsMatch, type FinalScore } from "@/lib/scores/football-data";
import { logError, logWarn } from "@/lib/log";
import type { Database } from "@/types/database";

/**
 * Settle bets automatically using final scores from football-data.org
 * (free) -- independent of the odds provider. Only touches fixtures that
 * still have unsettled bets, and only the ones it can confidently match
 * to a finished match (both team names + the date line up). Anything it
 * can't match is left for /admin/settlement.
 *
 * Score data is just an input to fn_admin_settle_fixture, which does the
 * real work (grade h2h/totals, close markets, settle resolved bets via
 * the normal fn_settle_bet path).
 */
export async function settleFromFreeScores(
  supabase: SupabaseClient<Database>
): Promise<{ matched: number; settled: number; unmatched: number; skipped: boolean; errors: string[] }> {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { matched: 0, settled: 0, unmatched: 0, skipped: true, errors: [] };
  }

  const errors: string[] = [];

  // Fixtures past kickoff, not yet finished, that still have a pending
  // bet selection riding on them.
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingSel, error: selErr } = await supabase
    .from("bet_selections")
    .select("fixture_id, fixtures!inner(id, home_team, away_team, commence_time, status)")
    .eq("status", "pending")
    .gte("fixtures.commence_time", cutoff)
    .neq("fixtures.status", "finished");
  if (selErr) return { matched: 0, settled: 0, unmatched: 0, skipped: false, errors: [selErr.message] };

  type Fx = { id: string; home_team: string; away_team: string; commence_time: string; status: string };
  const fixtures = new Map<string, Fx>();
  for (const row of pendingSel ?? []) {
    const f = (row as unknown as { fixtures: Fx }).fixtures;
    if (f) fixtures.set(f.id, f);
  }
  if (fixtures.size === 0) {
    return { matched: 0, settled: 0, unmatched: 0, skipped: false, errors: [] };
  }

  let scores: FinalScore[];
  try {
    scores = await fetchRecentFinalScores(5);
  } catch (e) {
    await logError("sync:free-scores", e, { step: "fetch" });
    return { matched: 0, settled: 0, unmatched: 0, skipped: false, errors: [(e as Error).message] };
  }

  let matched = 0;
  let settled = 0;
  let unmatched = 0;

  for (const fx of fixtures.values()) {
    const kickoff = new Date(fx.commence_time).getTime();
    const hit = scores.find((s) => {
      const within = Math.abs(new Date(s.utcDate).getTime() - kickoff) < 36 * 60 * 60 * 1000;
      if (!within) return false;
      return (
        (teamsMatch(fx.home_team, s.home) && teamsMatch(fx.away_team, s.away)) ||
        // occasionally home/away are flipped between providers -- only
        // trust that when BOTH sides still match
        (teamsMatch(fx.home_team, s.away) && teamsMatch(fx.away_team, s.home))
      );
    });

    if (!hit) {
      unmatched++;
      continue;
    }
    matched++;

    // Keep our fixture's own home/away orientation; map the matched
    // result onto it.
    const flipped = teamsMatch(fx.home_team, hit.away) && teamsMatch(fx.away_team, hit.home) && !teamsMatch(fx.home_team, hit.home);
    const homeScore = flipped ? hit.awayScore : hit.homeScore;
    const awayScore = flipped ? hit.homeScore : hit.awayScore;

    const { error } = await supabase.rpc("fn_admin_settle_fixture", {
      p_fixture_id: fx.id,
      p_home_score: homeScore,
      p_away_score: awayScore,
    });
    if (error) {
      errors.push(`${fx.id}: ${error.message}`);
      await logError("sync:free-scores", error.message, { fixtureId: fx.id, step: "settle" });
    } else {
      settled++;
    }
  }

  if (unmatched > 0) {
    await logWarn("sync:free-scores", `${unmatched} started fixture(s) with open bets had no matching result`, {
      matched,
      settled,
      unmatched,
    });
  }

  return { matched, settled, unmatched, skipped: false, errors };
}
