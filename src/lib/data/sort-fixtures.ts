import type { FixtureWithOdds } from "@/lib/data/fixture-types";

// Lower = shown first. Football (soccer) leads, then the globally popular
// team sports, then the long tail. Anything unlisted sorts after everything
// listed. Kept here (not in odds-api/client, which has import-time side
// effects) so server data code can use it freely.
const SPORT_GROUP_PRIORITY: Record<string, number> = {
  Soccer: 0,
  Basketball: 1,
  Tennis: 2,
  Cricket: 3,
  "Rugby Union": 4,
  "Rugby League": 5,
  "American Football": 6,
  "Ice Hockey": 7,
  Baseball: 8,
  Boxing: 9,
  "Mixed Martial Arts": 10,
  Golf: 11,
};

// Within soccer: the big European leagues + the marquee club/international
// competitions ahead of the domestic second divisions and minor leagues.
const TOP_COMPETITION_PRIORITY: Record<string, number> = {
  EPL: 0,
  "English Premier League": 0,
  "UEFA Champions League": 1,
  "La Liga - Spain": 2,
  "Serie A - Italy": 3,
  "Bundesliga - Germany": 4,
  "Ligue 1 - France": 5,
  "UEFA Europa League": 6,
  "Primeira Liga - Portugal": 7,
  "Dutch Eredivisie": 8,
  "UEFA Nations League": 9,
  "FIFA World Cup": 10,
  "UEFA Euro": 11,
  "Copa America": 12,
  "Copa Libertadores": 13,
  "EFL Championship": 14,
  MLS: 15,
};

function groupRank(name: string | undefined | null): number {
  return name && name in SPORT_GROUP_PRIORITY ? SPORT_GROUP_PRIORITY[name] : 50;
}

function competitionRank(title: string | undefined | null): number {
  return title && title in TOP_COMPETITION_PRIORITY ? TOP_COMPETITION_PRIORITY[title] : 40;
}

/**
 * Order fixtures the way a bettor expects a sportsbook to: football first,
 * big leagues before minor ones, then by kickoff time. Live matches (in
 * play now) always float above not-yet-started ones.
 */
export function sortFixturesByPopularity(fixtures: FixtureWithOdds[]): FixtureWithOdds[] {
  return [...fixtures].sort((a, b) => {
    const liveA = a.status === "live" ? 0 : 1;
    const liveB = b.status === "live" ? 0 : 1;
    if (liveA !== liveB) return liveA - liveB;

    const gA = groupRank(a.competition?.sport_group?.name);
    const gB = groupRank(b.competition?.sport_group?.name);
    if (gA !== gB) return gA - gB;

    const cA = competitionRank(a.competition?.title);
    const cB = competitionRank(b.competition?.title);
    if (cA !== cB) return cA - cB;

    return new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime();
  });
}
