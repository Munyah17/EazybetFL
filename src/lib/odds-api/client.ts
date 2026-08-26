const BASE_URL = process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";

/** Same provider, multiple separate keys/accounts -- The Odds API's monthly
 * quota is per-key, so rotating to the next key on exhaustion instead of
 * failing outright keeps syncing working once the first key(s) run out for
 * the month. FALLBACK_3 is listed first deliberately: as of 2026-08-20 it's
 * the only one of the four with real quota left (fresh, 500/500), the other
 * three are dead/exhausted -- leading with it avoids 2-3 guaranteed-failed
 * requests every sync run. Re-order once the older keys' quota resets. */
const API_KEYS = [
  process.env.ODDS_API_KEY_FALLBACK_3,
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

/** Any 401 means *this* key doesn't work right now -- quota exhausted,
 * revoked, expired, whatever the reason, the correct response is the same:
 * try the next key rather than failing the whole sync outright. Previously
 * this only matched quota-specific wording, so a merely-invalid/revoked key
 * (a different 401 message) skipped rotation and took down sync entirely
 * even with working fallback keys configured. */
function isKeyRejected(status: number) {
  return status === 401;
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
    if (isKeyRejected(res.status) && activeKeyIndex < API_KEYS.length - 1) {
      activeKeyIndex++;
      lastError = `key ${activeKeyIndex} rejected: ${res.status} ${body}`;
      continue;
    }

    throw new Error(`Odds API ${path} failed: ${res.status} ${body}`);
  }

  throw new Error(`Odds API ${path} failed on all ${API_KEYS.length} keys: ${lastError}`);
}

export type OddsApiKeyStatus = {
  envVar: string;
  masked: string;
  configured: boolean;
  remaining: number | null;
  used: number | null;
  status: "ok" | "low" | "exhausted" | "error" | "not_configured";
  error?: string;
};

const LOW_QUOTA_THRESHOLD = 20;

/** Kept separate from API_KEYS (which drops env var names once filtered) so
 * the super admin status panel can label each key by which env var it came
 * from. Uses /sports, which The Odds API confirms is free -- x-requests-last
 * comes back 0 on it -- so checking status here never burns real quota. */
const NAMED_KEYS: { envVar: string; key: string | undefined }[] = [
  { envVar: "ODDS_API_KEY_FALLBACK_3", key: process.env.ODDS_API_KEY_FALLBACK_3 },
  { envVar: "ODDS_API_KEY", key: process.env.ODDS_API_KEY },
  { envVar: "ODDS_API_KEY_FALLBACK_1", key: process.env.ODDS_API_KEY_FALLBACK_1 },
  { envVar: "ODDS_API_KEY_FALLBACK_2", key: process.env.ODDS_API_KEY_FALLBACK_2 },
];

export async function checkKeysStatus(): Promise<OddsApiKeyStatus[]> {
  return Promise.all(
    NAMED_KEYS.map(async ({ envVar, key }): Promise<OddsApiKeyStatus> => {
      if (!key || key === "not-configured-placeholder") {
        return { envVar, masked: "—", configured: false, remaining: null, used: null, status: "not_configured" };
      }
      const masked = key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : "••••";
      try {
        const res = await fetch(`${BASE_URL}/sports?apiKey=${key}`, { cache: "no-store" });
        if (!res.ok) {
          return { envVar, masked, configured: true, remaining: null, used: null, status: "error", error: `HTTP ${res.status}` };
        }
        const remaining = Number(res.headers.get("x-requests-remaining"));
        const used = Number(res.headers.get("x-requests-used"));
        const status = remaining <= 0 ? "exhausted" : remaining <= LOW_QUOTA_THRESHOLD ? "low" : "ok";
        return { envVar, masked, configured: true, remaining, used, status };
      } catch (e) {
        return { envVar, masked, configured: true, remaining: null, used: null, status: "error", error: (e as Error).message };
      }
    })
  );
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

/** Lower = shown first. Reflects global/African viewership and betting
 * volume, not The Odds API's (effectively alphabetical) group order --
 * which is why "American Football" was outranking "Soccer" before this
 * existed. Soft priority, not a filter: anything not listed just sorts
 * after everything that is. */
const SPORT_GROUP_PRIORITY: Record<string, number> = {
  Soccer: 0,
  Basketball: 1,
  Tennis: 2,
  Cricket: 3,
  "Rugby Union": 4,
  "Rugby League": 5,
  Boxing: 6,
  "Mixed Martial Arts": 7,
  Golf: 8,
  "Ice Hockey": 9,
  Handball: 10,
  "American Football": 11,
  Baseball: 12,
  "Aussie Rules": 13,
  Lacrosse: 14,
};

export function groupPriority(group: string) {
  return SPORT_GROUP_PRIORITY[group] ?? 20;
}

/** Same idea, within soccer specifically -- the "big" European leagues
 * (and the two most globally-watched club/international competitions)
 * ahead of the long tail of domestic second divisions and minor leagues. */
const TOP_COMPETITION_PRIORITY: Record<string, number> = {
  EPL: 0,
  "UEFA Champions League": 1,
  "La Liga - Spain": 2,
  "Serie A - Italy": 3,
  "Bundesliga - Germany": 4,
  "Ligue 1 - France": 5,
  "Dutch Eredivisie": 6,
  "Primeira Liga - Portugal": 7,
  "UEFA Europa League": 8,
  "UEFA Nations League": 9,
  "FIFA World Cup": 10,
  "UEFA Euro": 11,
  "Copa América": 12,
  "Copa Libertadores": 13,
};

export function competitionPriority(title: string) {
  return TOP_COMPETITION_PRIORITY[title] ?? 50;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
