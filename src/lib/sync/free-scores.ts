import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchRecentFinalScores,
  fetchLiveMatches,
  teamsMatch,
  type FinalScore,
} from "@/lib/scores/football-data";
import { groqSameFixture } from "@/lib/groq";
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
): Promise<{ matched: number; settled: number; unmatched: number; liveUpdated: number; skipped: boolean; errors: string[] }> {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { matched: 0, settled: 0, unmatched: 0, liveUpdated: 0, skipped: true, errors: [] };
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
  if (selErr) return { matched: 0, settled: 0, unmatched: 0, liveUpdated: 0, skipped: false, errors: [selErr.message] };

  type Fx = { id: string; home_team: string; away_team: string; commence_time: string; status: string };
  const fixtures = new Map<string, Fx>();
  for (const row of pendingSel ?? []) {
    const f = (row as unknown as { fixtures: Fx }).fixtures;
    if (f) fixtures.set(f.id, f);
  }
  if (fixtures.size === 0) {
    return { matched: 0, settled: 0, unmatched: 0, liveUpdated: 0, skipped: false, errors: [] };
  }

  let scores: FinalScore[];
  try {
    scores = await fetchRecentFinalScores(5);
  } catch (e) {
    await logError("sync:free-scores", e, { step: "fetch" });
    return { matched: 0, settled: 0, unmatched: 0, liveUpdated: 0, skipped: false, errors: [(e as Error).message] };
  }

  let matched = 0;
  let settled = 0;
  let unmatched = 0;
  let groqCalls = 0;

  for (const fx of fixtures.values()) {
    const kickoff = new Date(fx.commence_time).getTime();
    let hit = scores.find((s) => {
      const within = Math.abs(new Date(s.utcDate).getTime() - kickoff) < 36 * 60 * 60 * 1000;
      if (!within) return false;
      return (
        (teamsMatch(fx.home_team, s.home) && teamsMatch(fx.away_team, s.away)) ||
        // occasionally home/away are flipped between providers -- only
        // trust that when BOTH sides still match
        (teamsMatch(fx.home_team, s.away) && teamsMatch(fx.away_team, s.home))
      );
    });

    // Fuzzy fallback: when the deterministic matcher can't pair a fixture,
    // ask Groq (free LLM) whether a same-day feed result is the same match.
    // Capped per run -- this is a decision aid, not the hot path.
    if (!hit && groqCalls < 5) {
      const candidates = scores.filter(
        (s) => Math.abs(new Date(s.utcDate).getTime() - kickoff) < 36 * 60 * 60 * 1000
      );
      for (const c of candidates) {
        if (groqCalls >= 5) break;
        groqCalls++;
        const same = await groqSameFixture({
          ourHome: fx.home_team,
          ourAway: fx.away_team,
          feedHome: c.home,
          feedAway: c.away,
          ourKickoff: fx.commence_time,
          feedDate: c.utcDate,
        });
        if (same === true) {
          hit = c;
          break;
        }
      }
    }

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

  // ---- live scorelines for the in-play cash-out pricing model ----
  // football-data.org's free tier also reports IN_PLAY/PAUSED matches;
  // writing them to fixtures lets fn_leg_win_probability price live legs.
  let liveUpdated = 0;
  try {
    const live = await fetchLiveMatches();
    if (live.length) {
      const { data: liveFx } = await supabase
        .from("fixtures")
        .select("id, home_team, away_team, commence_time, status")
        .in("status", ["upcoming", "live"])
        .lte("commence_time", new Date().toISOString());
      for (const f of liveFx ?? []) {
        const kickoff = new Date(f.commence_time).getTime();
        const hit = live.find((s) => {
          const within = Math.abs(new Date(s.utcDate).getTime() - kickoff) < 12 * 60 * 60 * 1000;
          if (!within) return false;
          return (
            (teamsMatch(f.home_team, s.home) && teamsMatch(f.away_team, s.away)) ||
            (teamsMatch(f.home_team, s.away) && teamsMatch(f.away_team, s.home))
          );
        });
        if (!hit) continue;
        const flipped =
          teamsMatch(f.home_team, hit.away) &&
          teamsMatch(f.away_team, hit.home) &&
          !teamsMatch(f.home_team, hit.home);
        const { error } = await supabase
          .from("fixtures")
          .update({
            status: "live",
            home_score: flipped ? hit.awayScore : hit.homeScore,
            away_score: flipped ? hit.homeScore : hit.awayScore,
            minute: hit.minute,
            updated_at: new Date().toISOString(),
          })
          .eq("id", f.id);
        if (!error) liveUpdated++;
      }
    }
  } catch (e) {
    await logError("sync:free-scores", e, { step: "live_scores" });
  }

  return { matched, settled, unmatched, liveUpdated, skipped: false, errors };
}
