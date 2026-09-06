import "server-only";

/**
 * football-data.org — free source of final scores for the major
 * competitions (Premier League, La Liga, Serie A, Bundesliga, Ligue 1,
 * Champions/Europa League, Eredivisie, Primeira Liga, Championship, World
 * Cup, Euros). Used only for bet settlement -- odds still come from the
 * odds provider. Free tier: register at football-data.org, ~10 req/min.
 */
const BASE = "https://api.football-data.org/v4";

export type FinalScore = {
  competitionCode: string;
  utcDate: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
};

type FdMatch = {
  utcDate: string;
  status: string;
  competition?: { code?: string };
  homeTeam?: { name?: string; shortName?: string };
  awayTeam?: { name?: string; shortName?: string };
  score?: { fullTime?: { home?: number | null; away?: number | null } };
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Every FINISHED match across the subscribed competitions in the window. */
export async function fetchRecentFinalScores(daysBack = 4): Promise<FinalScore[]> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) return [];

  const to = new Date();
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const url = `${BASE}/matches?dateFrom=${ymd(from)}&dateTo=${ymd(to)}&status=FINISHED`;

  const res = await fetch(url, {
    headers: { "X-Auth-Token": key },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`football-data.org ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = (await res.json()) as { matches?: FdMatch[] };
  const out: FinalScore[] = [];
  for (const m of body.matches ?? []) {
    const h = m.score?.fullTime?.home;
    const a = m.score?.fullTime?.away;
    if (m.status !== "FINISHED" || h == null || a == null) continue;
    const home = m.homeTeam?.name ?? m.homeTeam?.shortName;
    const away = m.awayTeam?.name ?? m.awayTeam?.shortName;
    if (!home || !away) continue;
    out.push({
      competitionCode: m.competition?.code ?? "",
      utcDate: m.utcDate,
      home,
      away,
      homeScore: h,
      awayScore: a,
    });
  }
  return out;
}

const COMBINING_MARKS = /\p{Diacritic}/gu;
const NOISE_WORDS = /\b(fc|cf|afc|sc|ac|as|ss|us|rc|cd|ud|sd|bk|if|sk|club|calcio|de|the)\b/g;

/** Loose team-name key: lowercase, accent- and noise-word-stripped,
 * alphanumerics only. "Manchester City FC" -> "manchestercity". */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/&/g, "and")
    .replace(NOISE_WORDS, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Distinctive words (len >= 4) for token-overlap matching when the full
 * normalized strings differ ("bayernmunchen" vs "bayernmunich"). */
function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !["club", "calcio", "sport"].includes(w));
}

export function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(tokens(a));
  return tokens(b).some((w) => ta.has(w));
}
