// Client-safe types & helpers for fixture data. No server-only imports here
// (next/headers etc.) -- this file is imported by client components like
// FixtureRow, so keep it free of anything that would drag the server
// Supabase client into the client bundle.

export type FixtureWithOdds = {
  id: string;
  odds_api_event_id: string | null;
  home_team: string;
  away_team: string;
  commence_time: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  extra_markets_synced_at: string | null;
  competition: {
    id: string;
    title: string;
    odds_api_key: string;
    sport_group: { id: string; key: string; name: string; icon: string } | null;
  } | null;
  markets: {
    id: string;
    market_key: string;
    market_name: string;
    status: string;
    odds_outcomes: { id: string; name: string; point: number | null; price: number; display_order: number }[];
  }[];
};

export function h2hOutcomes(fixture: FixtureWithOdds) {
  const market = fixture.markets.find((m) => m.market_key === "h2h" && m.status === "open");
  if (!market) return null;

  const home = market.odds_outcomes.find((o) => o.name === fixture.home_team);
  const away = market.odds_outcomes.find((o) => o.name === fixture.away_team);
  const draw = market.odds_outcomes.find((o) => o.name === "Draw");

  return { marketId: market.id, home, draw, away };
}
