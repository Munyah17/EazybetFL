/**
 * Normalization layer for OddsPapi
 * Converts OddsPapi responses to unified schema
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
  OddsPapiFixture,
  OddsPapiBookmakerOdds,
  OddsPapiMarket,
  OddsPapiOutcome,
  OddsPapiOutcomePlayer,
} from "./client";

export function normalizeOddsPapiFixture(fixture: OddsPapiFixture): UnifiedOdds {
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const bookmakers: BookmakerOdds[] = normalizeBookmakers(fixture.bookmakerOdds);

  const markets: Market[] = extractMarkets(fixture.bookmakerOdds);

  return {
    matchId: `oddspapi-${fixture.fixtureId}`,
    providerMatchId: String(fixture.fixtureId),
    provider: "oddspapi" as ProviderName,
    sport: "unknown", // OddsPapi uses sportId, would need mapping
    league: "unknown", // OddsPapi uses tournamentId, would need mapping
    leagueId: String(fixture.tournamentId),
    homeTeam: "Team 1", // OddsPapi uses participant IDs, would need lookup
    awayTeam: "Team 2",
    startTime: fixture.startTime,
    isLive: fixture.statusId === 1, // Assuming statusId 1 = live
    bookmakers,
    lastUpdated: fixture.updatedAt,
    updateTimestamp: timestamp,
    markets,
    dataFreshness: "fresh",
  };
}

function normalizeBookmakers(
  bookmakerOdds: Record<string, OddsPapiBookmakerOdds>
): BookmakerOdds[] {
  const result: BookmakerOdds[] = [];

  for (const [bookmakerId, bmData] of Object.entries(bookmakerOdds)) {
    if (!bmData.bookmakerIsActive) continue;

    const markets: Record<string, MarketOdds> = {};

    for (const [marketKey, market] of Object.entries(bmData.markets)) {
      markets[marketKey] = normalizeMarket(market);
    }

    result.push({
      bookmakerId,
      bookmakerName: bookmakerId, // OddsPapi uses IDs, would need name mapping
      isActive: bmData.bookmakerIsActive,
      lastUpdated: new Date().toISOString(),
      markets,
    });
  }

  return result;
}

function normalizeMarket(market: OddsPapiMarket): MarketOdds {
  const outcomes: Record<string, OutcomeOdds> = {};

  for (const [outcomeKey, outcome] of Object.entries(market.outcomes)) {
    const normalized = normalizeOutcome(outcome);
    if (normalized) {
      outcomes[outcomeKey] = normalized;
    }
  }

  return {
    name: "market", // OddsPapi structure is complex, would need mapping
    outcomes,
  };
}

function normalizeOutcome(outcome: OddsPapiOutcome): OutcomeOdds | null {
  // OddsPapi has player-level outcomes, take the first active one
  for (const [playerId, player] of Object.entries(outcome.players)) {
    if (player.active) {
      const result: OutcomeOdds = {
        name: player.playerName,
        odds: player.price,
      };

      // Convert decimal to American odds
      result.americanOdds = decimalToAmerican(player.price);

      return result;
    }
  }

  return null;
}

function extractMarkets(
  bookmakerOdds: Record<string, OddsPapiBookmakerOdds>
): Market[] {
  const marketSet = new Set<string>();

  for (const bmData of Object.values(bookmakerOdds)) {
    for (const marketKey of Object.keys(bmData.markets)) {
      marketSet.add(marketKey);
    }
  }

  return Array.from(marketSet).map((name) => ({
    id: name,
    name,
    type: "prematch",
    category: "other", // Would need market type mapping
  }));
}

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`;
  } else {
    return `${Math.round(-100 / (decimal - 1))}`;
  }
}
