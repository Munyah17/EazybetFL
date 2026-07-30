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

export type QuickMarketKey = "h2h" | "totals";

export type QuickMarketOutcome = { id: string; name: string; label: string; price: number };

/** Compact-row odds for the match-list market switcher (1X2 vs Over/Under).
 * Both markets are already bulk-synced for every fixture (see
 * BULK_MARKET_KEYS in enrich-fixture.ts), so this needs no extra fetch --
 * it just reads whichever of the two markets is already on the fixture. */
export function quickMarketOutcomes(
  fixture: FixtureWithOdds,
  marketKey: QuickMarketKey
): { marketId: string; marketName: string; outcomes: QuickMarketOutcome[] } | null {
  const market = fixture.markets.find((m) => m.market_key === marketKey && m.status === "open");
  if (!market || market.odds_outcomes.length === 0) return null;

  if (marketKey === "h2h") {
    const home = market.odds_outcomes.find((o) => o.name === fixture.home_team);
    const draw = market.odds_outcomes.find((o) => o.name === "Draw");
    const away = market.odds_outcomes.find((o) => o.name === fixture.away_team);
    const outcomes: QuickMarketOutcome[] = [];
    if (home) outcomes.push({ id: home.id, name: home.name, label: "1", price: home.price });
    if (draw) outcomes.push({ id: draw.id, name: draw.name, label: "X", price: draw.price });
    if (away) outcomes.push({ id: away.id, name: away.name, label: "2", price: away.price });
    return outcomes.length ? { marketId: market.id, marketName: market.market_name, outcomes } : null;
  }

  // totals: several point lines can be priced (2.5, 3.5, ...) -- use the
  // lowest line that actually has both an Over and an Under quoted.
  const points = Array.from(new Set(market.odds_outcomes.map((o) => o.point).filter((p): p is number => p !== null))).sort(
    (a, b) => a - b
  );
  for (const point of points) {
    const over = market.odds_outcomes.find((o) => o.point === point && o.name === "Over");
    const under = market.odds_outcomes.find((o) => o.point === point && o.name === "Under");
    if (over && under) {
      return {
        marketId: market.id,
        marketName: market.market_name,
        outcomes: [
          { id: over.id, name: over.name, label: `Over ${point}`, price: over.price },
          { id: under.id, name: under.name, label: `Under ${point}`, price: under.price },
        ],
      };
    }
  }
  return null;
}
