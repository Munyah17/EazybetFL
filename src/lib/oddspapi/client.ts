const BASE_URL = process.env.ODDSPAPI_BASE_URL ?? "https://api.oddspapi.io/v4";

const API_KEY = process.env.ODDSPAPI_API_KEY;

if (!API_KEY) {
  throw new Error("No ODDSPAPI_API_KEY configured");
}

export type OddsPapiSport = {
  sportId: number;
  name: string;
};

export type OddsPapiTournament = {
  tournamentId: number;
  sportId: number;
  name: string;
};

export type OddsPapiOutcomePlayer = {
  active: boolean;
  betslip: string;
  bookmakerOutcomeId: string;
  changedAt: string;
  limit: number | null;
  playerName: string;
  price: number;
};

export type OddsPapiOutcome = {
  players: Record<string, OddsPapiOutcomePlayer>;
};

export type OddsPapiMarket = {
  outcomes: Record<string, OddsPapiOutcome>;
};

export type OddsPapiBookmakerOdds = {
  bookmakerIsActive: boolean;
  bookmakerFixtureId: string;
  fixturePath: string;
  markets: Record<string, OddsPapiMarket>;
};

export type OddsPapiFixture = {
  fixtureId: number;
  participant1Id: number;
  participant2Id: number;
  sportId: number;
  tournamentId: number;
  seasonId: number;
  statusId: number;
  hasOdds: boolean;
  startTime: string;
  trueStartTime: string | null;
  trueEndTime: string | null;
  updatedAt: string;
  bookmakerOdds: Record<string, OddsPapiBookmakerOdds>;
};

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE_URL + path);
  url.searchParams.set("apiKey", API_KEY!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OddsPapi ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export const oddsPapi = {
  listSports: () => get<OddsPapiSport[]>("/sports"),
  listTournaments: (sportId: number) => get<OddsPapiTournament[]>("/tournaments", { sportId: String(sportId) }),
  /** Upcoming fixtures + odds for one or more leagues. tournamentIds is a
   * comma-separated list of OddsPapi tournament IDs (not The Odds API's
   * string sport keys -- the two providers use unrelated ID schemes, so
   * there's no automatic mapping from `competitions.odds_api_key`). */
  getOddsByTournaments: (tournamentIds: number[], bookmaker?: string) =>
    get<OddsPapiFixture[]>("/odds-by-tournaments", {
      tournamentIds: tournamentIds.join(","),
      ...(bookmaker ? { bookmaker } : {}),
      oddsFormat: "decimal",
    }),
  getFixtures: (tournamentIds: number[]) =>
    get<OddsPapiFixture[]>("/fixtures", { tournamentIds: tournamentIds.join(",") }),
};
