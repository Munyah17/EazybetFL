/**
 * Unified odds service with multi-provider failover
 * Orchestrates API calls, normalization, health monitoring, circuit breaking, and caching
 */

import type { UnifiedOdds, ProviderName } from "@/types/odds";
import { ProviderError, AllProvidersFailedError } from "@/types/odds";
import { oddsApi } from "../odds-api/client";
import { normalizeTheOddsApiEvent } from "../odds-api/normalizer";
import { apiSports } from "../api-sports/client";
import { normalizeApiSportsOdds } from "../api-sports/normalizer";
import { oddsPapi } from "../oddspapi/client";
import { normalizeOddsPapiFixture } from "../oddspapi/normalizer";
import { recordSuccess, recordFailure, isProviderHealthy, updateRateLimit } from "./health-monitor";
import { canAttemptRequest, recordSuccess as cbRecordSuccess, recordFailure as cbRecordFailure } from "./circuit-breaker";
import { getCachedOdds, setCachedOdds, getStaleOdds } from "./cache";

// Provider configuration - ordered by priority (lower = higher priority)
const PROVIDER_CONFIG: ProviderName[] = ["the-odds-api", "api-sports", "oddspapi"];

export interface OddsFetchRequest {
  sportKey?: string;
  eventId?: string;
  fixtureId?: number;
  league?: number;
  season?: number;
  date?: string;
  isLive?: boolean;
}

export async function getOdds(request: OddsFetchRequest): Promise<UnifiedOdds> {
  const cacheKey = generateCacheKey(request);
  
  // Try cache first
  const cached = await getCachedOdds(cacheKey);
  if (cached && !cached.isStale) {
    return cached.data;
  }

  // Try each provider in priority order
  const attemptedProviders: ProviderName[] = [];
  let lastError: Error | null = null;

  for (const provider of PROVIDER_CONFIG) {
    attemptedProviders.push(provider);

    // Skip if circuit breaker is open
    if (!canAttemptRequest(provider)) {
      continue;
    }

    // Skip if provider is unhealthy (but allow if all are unhealthy)
    if (!isProviderHealthy(provider) && attemptedProviders.length < PROVIDER_CONFIG.length) {
      continue;
    }

    try {
      const startTime = Date.now();
      const odds = await fetchFromProvider(provider, request);
      const latency = Date.now() - startTime;

      // Record success
      recordSuccess(provider, latency);
      cbRecordSuccess(provider);

      // Cache the result
      await setCachedOdds(cacheKey, odds, request.isLive || false);

      return odds;
    } catch (error) {
      lastError = error as Error;
      const latency = Date.now() - (Date.now() - 0); // Approximate latency

      // Record failure
      recordFailure(provider, latency, error as Error);
      cbRecordFailure(provider);

      // Check if it's a rate limit error
      if (error instanceof ProviderError && error.isRateLimit) {
        updateRateLimit(provider, 0, 100); // Mark as exhausted
      }

      continue;
    }
  }

  // All providers failed - try stale cache as fallback
  const stale = await getStaleOdds(cacheKey);
  if (stale) {
    return stale.data;
  }

  // No cache available - throw error
  throw new AllProvidersFailedError(attemptedProviders, lastError || new Error("All providers failed"));
}

async function fetchFromProvider(
  provider: ProviderName,
  request: OddsFetchRequest
): Promise<UnifiedOdds> {
  switch (provider) {
    case "the-odds-api":
      return fetchFromTheOddsApi(request);
    case "api-sports":
      return fetchFromApiSports(request);
    case "oddspapi":
      return fetchFromOddsPapi(request);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function fetchFromTheOddsApi(request: OddsFetchRequest): Promise<UnifiedOdds> {
  if (!request.sportKey) {
    throw new ProviderError("the-odds-api", "sportKey is required");
  }

  if (request.eventId) {
    const event = await oddsApi.getEventOdds(request.sportKey, request.eventId, "h2h");
    return normalizeTheOddsApiEvent(event);
  } else {
    const events = await oddsApi.getOdds(request.sportKey, "h2h");
    if (events.length === 0) {
      throw new ProviderError("the-odds-api", "No odds found");
    }
    return normalizeTheOddsApiEvent(events[0]);
  }
}

async function fetchFromApiSports(request: OddsFetchRequest): Promise<UnifiedOdds> {
  if (request.fixtureId) {
    const response = await apiSports.getOddsByFixture("football", request.fixtureId);
    if (response.response.length === 0) {
      throw new ProviderError("api-sports", "No odds found for fixture");
    }
    return normalizeApiSportsOdds(response.response[0], "football");
  } else if (request.league && request.season) {
    const response = await apiSports.getOddsByLeague("football", request.league, request.season);
    if (response.response.length === 0) {
      throw new ProviderError("api-sports", "No odds found for league/season");
    }
    return normalizeApiSportsOdds(response.response[0], "football");
  } else if (request.date) {
    const response = await apiSports.getOddsByDate("football", request.date);
    if (response.response.length === 0) {
      throw new ProviderError("api-sports", "No odds found for date");
    }
    return normalizeApiSportsOdds(response.response[0], "football");
  } else {
    throw new ProviderError("api-sports", "fixtureId, league/season, or date is required");
  }
}

async function fetchFromOddsPapi(request: OddsFetchRequest): Promise<UnifiedOdds> {
  // OddsPapi requires tournament IDs, which would need mapping from league IDs
  // For now, this is a placeholder implementation
  throw new ProviderError("oddspapi", "Not yet implemented - requires tournament ID mapping");
}

function generateCacheKey(request: OddsFetchRequest): string {
  const parts = [
    request.sportKey,
    request.eventId,
    request.fixtureId,
    request.league,
    request.season,
    request.date,
  ].filter(Boolean);
  return parts.join("-") || "default";
}

export async function getOddsBulk(request: OddsFetchRequest): Promise<UnifiedOdds[]> {
  // For bulk requests, we'd need to implement batching logic
  // For now, return single result
  const odds = await getOdds(request);
  return [odds];
}
