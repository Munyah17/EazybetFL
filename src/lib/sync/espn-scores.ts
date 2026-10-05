import type { SupabaseClient } from "@supabase/supabase-js";
import { teamsMatch } from "@/lib/scores/football-data";
import { logError, logWarn } from "@/lib/log";
import type { Database } from "@/types/database";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

/** our competitions.odds_api_key -> ESPN scoreboard path. ESPN's scoreboard
 * endpoint is free, unauthenticated and covers most leagues we take bets on --
 * this is the primary safety net when the odds provider's key is out of quota
 * (its /scores endpoint stops working entirely, which is what stranded settled
 * matches as 'Open' when the monthly quota ran out). */
const ESPN_LEAGUES: Record<string, string> = {
  soccer_epl: "soccer/eng.1",
  soccer_efl_champ: "soccer/eng.2",
  soccer_england_league1: "soccer/eng.3",
  soccer_england_league2: "soccer/eng.4",
  soccer_england_efl_cup: "soccer/eng.league_cup",
  soccer_fa_cup: "soccer/eng.fa",
  soccer_spain_la_liga: "soccer/esp.1",
  soccer_italy_serie_a: "soccer/ita.1",
  soccer_germany_bundesliga: "soccer/ger.1",
  soccer_france_ligue_one: "soccer/fra.1",
  soccer_netherlands_eredivisie: "soccer/ned.1",
  soccer_portugal_primeira_liga: "soccer/por.1",
  soccer_scotland_premiership: "soccer/sco.1",
  soccer_belgium_first_div: "soccer/bel.1",
  soccer_turkey_super_league: "soccer/tur.1",
  soccer_uefa_champs_league: "soccer/uefa.champions",
  soccer_uefa_europa_league: "soccer/uefa.europa",
  soccer_uefa_europa_conference_league: "soccer/uefa.europa.conf",
  soccer_uefa_nations_league: "soccer/uefa.nations",
  soccer_fifa_world_cup: "soccer/fifa.world",
  soccer_fifa_world_cup_qualifiers_europe: "soccer/fifa.worldq.uefa",
  soccer_conmebol_copa_libertadores: "soccer/conmebol.libertadores",
  soccer_brazil_campeonato: "soccer/bra.1",
  soccer_brazil_serie_b: "soccer/bra.2",
  soccer_argentina_primera: "soccer/arg.1",
  soccer_mexico_ligamx: "soccer/mex.1",
  soccer_usa_mls: "soccer/usa.1",
  americanfootball_nfl: "football/nfl",
  americanfootball_ncaaf: "football/college-football",
  basketball_nba: "basketball/nba",
  basketball_nba_preseason: "basketball/nba",
  basketball_ncaab: "basketball/mens-college-basketball",
  basketball_wnba: "basketball/wnba",
  basketball_euroleague: "basketball/euroleague",
  icehockey_nhl: "hockey/nhl",
  baseball_mlb: "baseball/mlb",
  mma_mixed_martial_arts: "mma/ufc",
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: { displayName?: string; shortDisplayName?: string; name?: string };
};

type EspnEvent = {
  id: string;
  date: string;
  status?: { type?: { completed?: boolean; state?: string } };
  competitions?: { competitors?: EspnCompetitor[] }[];
};

type PendingFixture = {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  odds_api_key: string;
};

function yyyymmdd(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** ESPN's `dates` param only honours single days (YYYYMMDD); a range like
 * YYYYMMDD-YYYYMMDD silently returns no events. So we walk the window one
 * UTC day at a time -- capped at 7 days -- and merge the results. */
async function fetchEspnScoreboard(leaguePath: string, from: Date, to: Date): Promise<EspnEvent[]> {
  const events = new Map<string, EspnEvent>();
  const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const last = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  let days = 0;
  while (day.getTime() <= last && days < 7) {
    const url = `${ESPN_BASE}/${leaguePath}/scoreboard?dates=${yyyymmdd(day)}&limit=400`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`ESPN ${leaguePath} ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const body = (await res.json()) as { events?: EspnEvent[] };
    for (const ev of body.events ?? []) events.set(ev.id, ev);
    day.setUTCDate(day.getUTCDate() + 1);
    days++;
  }
  return [...events.values()];
}

/** Extract home/away team name + score from an ESPN event, normalized so the
 * caller always sees (home, away) regardless of competitor ordering. */
function espnScore(ev: EspnEvent): { home: string; away: string; homeScore: number; awayScore: number } | null {
  const comps = ev.competitions?.[0]?.competitors ?? [];
  const home = comps.find((c) => c.homeAway === "home") ?? comps[0];
  const away = comps.find((c) => c.homeAway === "away") ?? comps[1];
  if (!home || !away) return null;
  const homeScore = Number(home.score);
  const awayScore = Number(away.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  return {
    home: home.team?.displayName ?? home.team?.name ?? "",
    away: away.team?.displayName ?? away.team?.name ?? "",
    homeScore,
    awayScore,
  };
}

/**
 * Settle pending fixtures using ESPN's free scoreboard feed. Only fetches the
 * leagues that actually have unresolved bets riding on them (one request per
 * league per tick, not a catalog sweep) and only trusts events ESPN marks
 * completed with both team names matching. Everything it can't confidently
 * match is left for the odds provider or manual settlement.
 */
export async function settleFromEspnScores(
  supabase: SupabaseClient<Database>
): Promise<{ matched: number; settled: number; unmatched: number; skippedLeagues: string[]; errors: string[] }> {
  const errors: string[] = [];
  const skippedLeagues: string[] = [];

  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingSel, error: selErr } = await supabase
    .from("bet_selections")
    .select("fixture_id, fixtures!inner(id, home_team, away_team, commence_time, status, competitions(odds_api_key))")
    .eq("status", "pending")
    .gte("fixtures.commence_time", cutoff)
    .neq("fixtures.status", "finished");
  if (selErr) {
    return { matched: 0, settled: 0, unmatched: 0, skippedLeagues, errors: [selErr.message] };
  }

  type Row = {
    fixtures: {
      id: string; home_team: string; away_team: string; commence_time: string; status: string;
      competitions: { odds_api_key: string } | { odds_api_key: string }[] | null;
    } | null;
  };

  const byLeague = new Map<string, PendingFixture[]>();
  for (const row of (pendingSel ?? []) as unknown as Row[]) {
    const f = row.fixtures;
    if (!f) continue;
    const comp = Array.isArray(f.competitions) ? f.competitions[0] : f.competitions;
    const key = comp?.odds_api_key;
    if (!key) continue;
    if (!ESPN_LEAGUES[key]) {
      if (!skippedLeagues.includes(key)) skippedLeagues.push(key);
      continue;
    }
    const list = byLeague.get(key) ?? [];
    if (!list.some((x) => x.id === f.id)) {
      list.push({ id: f.id, home_team: f.home_team, away_team: f.away_team, commence_time: f.commence_time, odds_api_key: key });
    }
    byLeague.set(key, list);
  }

  if (byLeague.size === 0) {
    return { matched: 0, settled: 0, unmatched: 0, skippedLeagues, errors };
  }

  let matched = 0;
  let settled = 0;
  let unmatched = 0;
  const now = new Date();

  for (const [key, fixtures] of byLeague) {
    const leaguePath = ESPN_LEAGUES[key];
    const earliest = new Date(Math.min(...fixtures.map((f) => new Date(f.commence_time).getTime())) - 12 * 60 * 60 * 1000);
    let events: EspnEvent[];
    try {
      events = await fetchEspnScoreboard(leaguePath, earliest, now);
    } catch (e) {
      errors.push(`${key}: ${(e as Error).message}`);
      await logError("sync:espn-scores", e, { key, step: "fetch" });
      continue;
    }

    const finished = events.filter((ev) => ev.status?.type?.completed === true);

    for (const fx of fixtures) {
      const kickoff = new Date(fx.commence_time).getTime();
      let hit: { home: string; away: string; homeScore: number; awayScore: number } | null = null;

      for (const ev of finished) {
        if (Math.abs(new Date(ev.date).getTime() - kickoff) > 36 * 60 * 60 * 1000) continue;
        const sc = espnScore(ev);
        if (!sc) continue;
        if (
          (teamsMatch(fx.home_team, sc.home) && teamsMatch(fx.away_team, sc.away)) ||
          // flipped home/away between providers -- trust it only when BOTH
          // sides match (the same guard the football-data matcher uses)
          (teamsMatch(fx.home_team, sc.away) && teamsMatch(fx.away_team, sc.home))
        ) {
          hit = sc;
          break;
        }
      }

      if (!hit) {
        unmatched++;
        continue;
      }
      matched++;

      const flipped =
        teamsMatch(fx.home_team, hit.away) && teamsMatch(fx.away_team, hit.home) && !teamsMatch(fx.home_team, hit.home);
      const { error } = await supabase.rpc("fn_admin_settle_fixture", {
        p_fixture_id: fx.id,
        p_home_score: flipped ? hit.awayScore : hit.homeScore,
        p_away_score: flipped ? hit.homeScore : hit.awayScore,
      });
      if (error) {
        errors.push(`${fx.id}: ${error.message}`);
        await logError("sync:espn-scores", error.message, { fixtureId: fx.id, step: "settle" });
      } else {
        settled++;
      }
    }
  }

  if (unmatched > 0) {
    await logWarn("sync:espn-scores", `${unmatched} fixture(s) with open bets had no ESPN result`, {
      matched, settled, unmatched, skippedLeagues,
    });
  }

  return { matched, settled, unmatched, skippedLeagues, errors };
}
