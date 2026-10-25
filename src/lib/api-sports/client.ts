/**
 * API-Sports client
 * Handles communication with API-Sports (v3.football.api-sports.io and other sports)
 */

const BASE_URL = "https://v3.football.api-sports.io";

const API_KEY = process.env.API_SPORTS_API_KEY;

if (!API_KEY) {
  throw new Error("No API_SPORTS_API_KEY configured");
}

const API_KEY_NON_NULL = API_KEY as string;

// API-Sports uses different base URLs for different sports
const SPORT_BASE_URLS: Record<string, string> = {
  football: "https://v3.football.api-sports.io",
  basketball: "https://v1.basketball.api-sports.io",
  baseball: "https://v1.baseball.api-sports.io",
  hockey: "https://v1.hockey.api-sports.io",
  tennis: "https://v1.tennis.api-sports.io",
  mma: "https://v1.mma.api-sports.io",
  rugby: "https://v1.rugby.api-sports.io",
  "american-football": "https://v1.american-football.api-sports.io",
  volleyball: "https://v1.volleyball.api-sports.io",
  handball: "https://v1.handball.api-sports.io",
  "formula-1": "https://v1.formula-1.api-sports.io",
  afl: "https://v1.afl.api-sports.io",
};

export type ApiSportsFixture = {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
      extra: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
    standings: boolean;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number;
    away: number;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
  events: any[];
};

export type ApiSportsOddsResponse = {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: ApiSportsOddsData[];
};

export type ApiSportsOddsData = {
  fixture: {
    id: number;
    date: string;
    time: string;
    timestamp: number;
    timezone: string;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  bookmakers: ApiSportsBookmaker[];
};

export type ApiSportsBookmaker = {
  id: number;
  name: string;
  bets: ApiSportsBet[];
};

export type ApiSportsBet = {
  id: number;
  name: string;
  values: ApiSportsBetValue[];
};

export type ApiSportsBetValue = {
  value: string;
  odd: string;
  handicap?: string;
};

export type ApiSportsBetType = {
  id: number;
  name: string;
};

async function get<T>(
  sport: string,
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const baseUrl = SPORT_BASE_URLS[sport] || BASE_URL;
  const url = new URL(baseUrl + path);
  url.searchParams.set("x-rapidapi-key", API_KEY_NON_NULL);
  const host = url.hostname;
  url.searchParams.set("x-rapidapi-host", host);
  
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-Sports ${sport} ${path} failed: ${res.status} ${body}`);
  }
  
  return res.json();
}

export const apiSports = {
  getFixtures: (sport: string = "football", params: Record<string, string> = {}) =>
    get<{ get: string; response: ApiSportsFixture[] }>(sport, "/fixtures", params),
  
  getOddsByFixture: (sport: string = "football", fixtureId: number) =>
    get<ApiSportsOddsResponse>(sport, `/odds`, { fixture: String(fixtureId) }),
  
  getOddsByLeague: (sport: string = "football", league: number, season: number) =>
    get<ApiSportsOddsResponse>(sport, `/odds`, { 
      league: String(league), 
      season: String(season) 
    }),
  
  getOddsByDate: (sport: string = "football", date: string) =>
    get<ApiSportsOddsResponse>(sport, `/odds`, { date }),
  
  getBetTypes: (sport: string = "football") =>
    get<{ get: string; response: ApiSportsBetType[] }>(sport, "/odds/bets"),
  
  getLiveFixtures: (sport: string = "football") =>
    get<{ get: string; response: ApiSportsFixture[] }>(sport, "/fixtures", { live: "all" }),
};
