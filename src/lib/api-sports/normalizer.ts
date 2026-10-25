/**
 * Normalization layer for API-Sports
 * Converts API-Sports responses to unified schema
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
  ApiSportsOddsData,
  ApiSportsBookmaker,
  ApiSportsBet,
  ApiSportsBetValue,
} from "./client";

export function normalizeApiSportsOdds(
  oddsData: ApiSportsOddsData,
  sport: string = "football"
): UnifiedOdds {
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const bookmakers: BookmakerOdds[] = oddsData.bookmakers.map((bm) =>
    normalizeBookmaker(bm)
  );

  const markets: Market[] = extractMarkets(oddsData.bookmakers);

  return {
    matchId: `api-sports-${sport}-${oddsData.fixture.id}`,
    providerMatchId: String(oddsData.fixture.id),
    provider: "api-sports" as ProviderName,
    sport,
    league: oddsData.league.name,
    leagueId: String(oddsData.league.id),
    homeTeam: oddsData.teams.home.name,
    awayTeam: oddsData.teams.away.name,
    startTime: oddsData.fixture.date,
    isLive: false, // API-Sports doesn't clearly indicate live status in odds response
    bookmakers,
    lastUpdated: now,
    updateTimestamp: timestamp,
    markets,
    dataFreshness: "fresh",
  };
}

function normalizeBookmaker(bm: ApiSportsBookmaker): BookmakerOdds {
  const markets: Record<string, MarketOdds> = {};

  for (const bet of bm.bets) {
    markets[bet.name.toLowerCase().replace(/\s+/g, "-")] = normalizeBet(bet);
  }

  return {
    bookmakerId: String(bm.id),
    bookmakerName: bm.name,
    isActive: true,
    lastUpdated: new Date().toISOString(),
    markets,
  };
}

function normalizeBet(bet: ApiSportsBet): MarketOdds {
  const outcomes: Record<string, OutcomeOdds> = {};

  for (const value of bet.values) {
    const key = value.value.toLowerCase().replace(/\s+/g, "-");
    outcomes[key] = normalizeBetValue(value);
  }

  return {
    name: bet.name,
    outcomes,
  };
}

function normalizeBetValue(value: ApiSportsBetValue): OutcomeOdds {
  const result: OutcomeOdds = {
    name: value.value,
    odds: parseFloat(value.odd),
  };

  if (value.handicap !== undefined) {
    result.point = parseFloat(value.handicap);
  }

  // Convert decimal to American odds
  result.americanOdds = decimalToAmerican(parseFloat(value.odd));

  return result;
}

function extractMarkets(bookmakers: ApiSportsBookmaker[]): Market[] {
  const marketSet = new Set<string>();

  for (const bm of bookmakers) {
    for (const bet of bm.bets) {
      marketSet.add(bet.name);
    }
  }

  return Array.from(marketSet).map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    type: "prematch",
    category: categorizeMarket(name),
  }));
}

function categorizeMarket(marketName: string): "moneyline" | "spread" | "total" | "props" | "other" {
  const lower = marketName.toLowerCase();
  
  if (lower.includes("match winner") || lower.includes("1x2") || lower.includes("home/draw/away")) {
    return "moneyline";
  }
  if (lower.includes("handicap") || lower.includes("spread")) {
    return "spread";
  }
  if (lower.includes("over") || lower.includes("under") || lower.includes("total")) {
    return "total";
  }
  if (lower.includes("both teams") || lower.includes("btts") || lower.includes("goals")) {
    return "props";
  }
  
  return "other";
}

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`;
  } else {
    return `${Math.round(-100 / (decimal - 1))}`;
  }
}
