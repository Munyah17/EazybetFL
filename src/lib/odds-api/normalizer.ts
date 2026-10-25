/**
 * Normalization layer for The-Odds-API
 * Converts The-Odds-API responses to unified schema
 */

import type {
  UnifiedOdds,
  BookmakerOdds,
  MarketOdds,
  OutcomeOdds,
  Market,
  ProviderName,
} from "@/types/odds";
import type {
  OddsApiEvent,
  OddsApiBookmaker,
  OddsApiMarket,
  OddsApiOutcome,
} from "./client";

export function normalizeTheOddsApiEvent(event: OddsApiEvent): UnifiedOdds {
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const bookmakers: BookmakerOdds[] = event.bookmakers.map((bm) =>
    normalizeBookmaker(bm)
  );

  const markets: Market[] = extractMarkets(event.bookmakers);

  return {
    matchId: `the-odds-api-${event.id}`,
    providerMatchId: event.id,
    provider: "the-odds-api" as ProviderName,
    sport: event.sport_title,
    league: extractLeagueFromSportKey(event.sport_key),
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    startTime: event.commence_time,
    isLive: isLiveEvent(event.commence_time),
    bookmakers,
    lastUpdated: now,
    updateTimestamp: timestamp,
    markets,
    dataFreshness: "fresh",
  };
}

function normalizeBookmaker(bm: OddsApiBookmaker): BookmakerOdds {
  const markets: Record<string, MarketOdds> = {};

  for (const market of bm.markets) {
    markets[market.key] = normalizeMarket(market);
  }

  return {
    bookmakerId: bm.key,
    bookmakerName: bm.title,
    isActive: true,
    lastUpdated: bm.last_update,
    markets,
  };
}

function normalizeMarket(market: OddsApiMarket): MarketOdds {
  const outcomes: Record<string, OutcomeOdds> = {};

  for (const outcome of market.outcomes) {
    const key = outcome.name.toLowerCase().replace(/\s+/g, "-");
    outcomes[key] = normalizeOutcome(outcome);
  }

  return {
    name: market.key,
    outcomes,
  };
}

function normalizeOutcome(outcome: OddsApiOutcome): OutcomeOdds {
  const result: OutcomeOdds = {
    name: outcome.name,
    odds: outcome.price,
  };

  if (outcome.point !== undefined) {
    result.point = outcome.point;
  }

  // Convert decimal to American odds
  result.americanOdds = decimalToAmerican(outcome.price);

  return result;
}

function extractLeagueFromSportKey(sportKey: string): string {
  // The-Odds-API sport_key format: "soccer_epl", "basketball_nba", etc.
  const parts = sportKey.split("_");
  if (parts.length > 1) {
    return parts.slice(1).join("_").replace(/_/g, " ").toUpperCase();
  }
  return sportKey.toUpperCase();
}

function extractMarkets(bookmakers: OddsApiBookmaker[]): Market[] {
  const marketSet = new Set<string>();

  for (const bm of bookmakers) {
    for (const market of bm.markets) {
      marketSet.add(market.key);
    }
  }

  return Array.from(marketSet).map((name) => ({
    id: name,
    name,
    type: "prematch",
    category: categorizeMarket(name),
  }));
}

function categorizeMarket(marketKey: string): "moneyline" | "spread" | "total" | "props" | "other" {
  if (marketKey === "h2h") return "moneyline";
  if (marketKey === "spreads" || marketKey === "alternate_spreads") return "spread";
  if (marketKey === "totals" || marketKey === "alternate_totals") return "total";
  if (marketKey === "btts") return "props";
  if (marketKey === "double_chance" || marketKey === "draw_no_bet") return "moneyline";
  return "other";
}

function isLiveEvent(commenceTime: string): boolean {
  const now = new Date();
  const start = new Date(commenceTime);
  const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < 3; // Consider live if started within last 3 hours
}

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`;
  } else {
    return `${Math.round(-100 / (decimal - 1))}`;
  }
}
