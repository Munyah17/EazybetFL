import { createClient } from "@/lib/supabase/server";
import type { FixtureWithOdds } from "@/lib/data/fixture-types";
import { sortFixturesByPopularity } from "@/lib/data/sort-fixtures";
import type { Database } from "@/types/database";

export type { FixtureWithOdds } from "@/lib/data/fixture-types";
export { h2hOutcomes } from "@/lib/data/fixture-types";

type FixtureStatus = Database["public"]["Enums"]["fixture_status"];

const FIXTURE_SELECT = `
  id, odds_api_event_id, home_team, away_team, commence_time, status, home_score, away_score, minute,
  extra_markets_synced_at,
  competition:competitions ( id, title, odds_api_key, sport_group:sport_groups ( id, key, name, icon ) ),
  markets ( id, market_key, market_name, status, odds_outcomes ( id, name, point, price, display_order ) )
`;

// Same shape as FIXTURE_SELECT but with `!inner` joins -- required for
// PostgREST to accept column filters on the embedded tables (otherwise the
// filters silently match nothing / error). Used only when the caller
// actually filters by competition or sport group.
const FIXTURE_SELECT_FILTERED = `
  id, odds_api_event_id, home_team, away_team, commence_time, status, home_score, away_score, minute,
  extra_markets_synced_at,
  competition:competitions!inner ( id, title, odds_api_key, sport_group:sport_groups!inner ( id, key, name, icon ) ),
  markets ( id, market_key, market_name, status, odds_outcomes ( id, name, point, price, display_order ) )
`;

/** Furthest-out kickoff an "upcoming" listing should show. The Odds API
 * returns far-future announcements (e.g. MMA fights a year+ away) which
 * used to bury this week's real fixtures at the bottom of every Upcoming
 * list. 21 days is generous for a bettor's near-term horizon. */
const UPCOMING_HORIZON_MS = 21 * 24 * 60 * 60 * 1000;

export async function getFixtureById(id: string): Promise<FixtureWithOdds | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as FixtureWithOdds) ?? null;
}

export async function getFixtures(opts: {
  status?: FixtureStatus[];
  sportGroupKey?: string;
  competitionKey?: string;
  limit?: number;
  orderBy?: "commence_time" | "popularity";
}): Promise<FixtureWithOdds[]> {
  const supabase = await createClient();
  // competition/sport-group filters MUST be applied at the database via
  // the !inner select -- doing it in JS after .limit() meant a competition
  // whose fixtures weren't among the first N globally-earliest rows got
  // back zero rows, which is what made competition pages 404.
  const filtered = !!(opts.competitionKey || opts.sportGroupKey);
  let query = supabase.from("fixtures").select(filtered ? FIXTURE_SELECT_FILTERED : FIXTURE_SELECT);

  if (filtered) {
    if (opts.competitionKey) query = query.eq("competitions.odds_api_key", opts.competitionKey);
    if (opts.sportGroupKey) query = query.eq("competitions.sport_groups.key", opts.sportGroupKey);
  }

  if (opts.status?.length) query = query.in("status", opts.status);
  const wantsUpcoming = opts.status?.includes("upcoming");
  const wantsLive = opts.status?.includes("live");
  if (wantsUpcoming && wantsLive) {
    // The windows are per-status: "upcoming" only makes sense for fixtures
    // that haven't kicked off, while "live" ones by definition already
    // started. A single gte(now) would exclude every live fixture (its
    // commence_time is in the past), so they have to be OR'd per status.
    const now = new Date().toISOString();
    const horizon = new Date(Date.now() + UPCOMING_HORIZON_MS).toISOString();
    const liveCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    query = query.or(
      `and(status.eq.upcoming,commence_time.gte.${now},commence_time.lte.${horizon}),` +
        `and(status.eq.live,commence_time.gte.${liveCutoff}),` +
        `status.not.in.(upcoming,live)`
    );
  } else if (wantsUpcoming) {
    // Nothing currently flips a fixture out of "upcoming" once its kickoff
    // passes without a matching finished result from the scores sync (which
    // only looks back 2 days) -- so fixtures that never got a final score
    // stay "upcoming" forever. Ordered oldest-commence_time-first with a
    // limit, those stale rows were filling the entire page and burying
    // today's real fixtures, making the front end look frozen no matter how
    // recently odds actually synced.
    query = query
      .gte("commence_time", new Date().toISOString())
      .lte("commence_time", new Date(Date.now() + UPCOMING_HORIZON_MS).toISOString());
  } else if (wantsLive) {
    // Same failure mode for "live": nothing flips a fixture out of "live"
    // when the scores feed stalls, so matches from weeks ago sit on the
    // Live page forever. A real match is never still in play more than a
    // few hours after kickoff -- anything older marked "live" is stale.
    query = query.gte("commence_time", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());
  }
  query = query.order("commence_time", { ascending: true });
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as FixtureWithOdds[];
  if ((opts.orderBy ?? "commence_time") === "popularity") {
    rows = sortFixturesByPopularity(rows);
  }
  return rows;
}
