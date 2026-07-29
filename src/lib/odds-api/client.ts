const BASE_URL = process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";

/** Same provider, 3 separate keys/accounts -- The Odds API's monthly quota is
 * per-key, so rotating to the next key on exhaustion instead of failing outright
 * keeps syncing working once the first key(s) run out for the month. */
const API_KEYS = [
  process.env.ODDS_API_KEY,
  process.env.ODDS_API_KEY_FALLBACK_1,
  process.env.ODDS_API_KEY_FALLBACK_2,
].filter((k): k is string => Boolean(k));

if (API_KEYS.length === 0) {
  throw new Error("No ODDS_API_KEY configured");
}

/** Index of the key currently believed to have quota left. Advances forward
 * only -- persists for the lifetime of the warm serverless instance (Fluid
 * Compute reuses instances across requests), so once a key is found
 * exhausted we stop wasting requests retrying it every sync run. Resets to
 * 0 on cold start, which just costs one wasted request against a
 * still-exhausted key before it re-advances -- cheap and self-healing. */
let activeKeyIndex = 0;

function isQuotaExceeded(status: number, body: string) {
  if (status !== 401) return false;
  const lower = body.toLowerCase();
  return lower.includes("quota") || lower.includes("usage credit");
}

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
  let lastError = "";

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const key = API_KEYS[activeKeyIndex];
    const url = new URL(BASE_URL + path);
    url.searchParams.set("apiKey", key);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) return res.json();

    const body = await res.text();
    if (isQuotaExceeded(res.status, body) && activeKeyIndex < API_KEYS.length - 1) {
      activeKeyIndex++;
      lastError = `key ${activeKeyIndex} exhausted: ${res.status} ${body}`;
      continue;
    }

    throw new Error(`Odds API ${path} failed: ${res.status} ${body}`);
  }

  throw new Error(`Odds API ${path} failed on all ${API_KEYS.length} keys: ${lastError}`);
}

export const oddsApi = {
  /** all=true includes out-of-season sports/competitions too -- without it
   * the API only returns whatever's currently active, which is why the
   * catalog was collapsing down to just 2-3 sports depending on the time
   * of year. */
  listSports: () => get<OddsApiSport[]>("/sports", { all: "true" }),
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
