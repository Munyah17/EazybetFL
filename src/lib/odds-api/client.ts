const BASE_URL = process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY!;

export type OddsApiSport = {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
};

export type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

export type OddsApiMarket = {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
};

export type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
};

export type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export type OddsApiScoreEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
};

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE_URL + path);
  url.searchParams.set("apiKey", API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Odds API ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export const oddsApi = {
  listSports: () => get<OddsApiSport[]>("/sports"),
  getOdds: (sportKey: string, markets = "h2h,spreads,totals") =>
    get<OddsApiEvent[]>(`/sports/${sportKey}/odds`, {
      regions: "uk,eu,us",
      markets,
      oddsFormat: "decimal",
      dateFormat: "iso",
    }),
  getScores: (sportKey: string, daysFrom = 2) =>
    get<OddsApiScoreEvent[]>(`/sports/${sportKey}/scores`, {
      daysFrom: String(daysFrom),
      dateFormat: "iso",
    }),
  /** Per-event endpoint -- the only one that unlocks "additional markets"
   * (btts, double chance, draw no bet, alternate lines) on our plan; the
   * bulk /odds endpoint 422s on them. Costs quota per market x region, so
   * this is called on demand for one fixture at a time, not in bulk. */
  getEventOdds: (sportKey: string, eventId: string, markets: string) =>
    get<OddsApiEvent>(`/sports/${sportKey}/events/${eventId}/odds`, {
      regions: "uk,eu",
      markets,
      oddsFormat: "decimal",
      dateFormat: "iso",
    }),
};

/** Markets confirmed available on our plan via the per-event endpoint
 * (verified live against the real API -- corners/cards markets were
 * requested and are NOT offered by The Odds API for any sport, so they're
 * deliberately excluded rather than faked). */
export const EXTRA_MARKET_KEYS = "btts,double_chance,draw_no_bet,alternate_spreads,alternate_totals";

export const DEFAULT_SYNC_SPORT_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_uefa_champs_league",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "basketball_nba",
  "icehockey_nhl",
  "americanfootball_nfl",
];

const GROUP_ICON: Record<string, string> = {
  Soccer: "SoccerBall",
  Basketball: "CircleDot",
  "American Football": "Trophy",
  Baseball: "CircleDot",
  "Ice Hockey": "CircleDot",
  Tennis: "CircleDot",
  Cricket: "CircleDot",
  "Rugby League": "Trophy",
  "Rugby Union": "Trophy",
  Boxing: "CircleDot",
  MMA: "CircleDot",
  Golf: "CircleDot",
  Esports: "Gamepad2",
};

export function iconForGroup(group: string) {
  return GROUP_ICON[group] ?? "Trophy";
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
