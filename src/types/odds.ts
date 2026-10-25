/**
 * Unified odds data schema for multi-provider architecture
 * Normalizes data from The-Odds-API, API-Sports, OddsPapi, etc.
 */

export type ProviderName = "the-odds-api" | "api-sports" | "oddspapi" | "cache";

export interface UnifiedOdds {
  // Match identification
  matchId: string;
  providerMatchId: string; // Original ID from provider for mapping
  provider: ProviderName;
  sport: string;
  league: string;
  leagueId?: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string; // ISO8601
  isLive: boolean;
  
  // Odds data
  bookmakers: BookmakerOdds[];
  lastUpdated: string; // ISO8601
  updateTimestamp: number; // Unix timestamp for easy comparison
  
  // Metadata
  markets: Market[];
  dataFreshness: "fresh" | "stale" | "expired";
}

export interface BookmakerOdds {
  bookmakerId: string;
  bookmakerName: string;
  isActive: boolean;
  lastUpdated: string; // ISO8601
  markets: Record<string, MarketOdds>;
}

export interface MarketOdds {
  name: string;
  outcomes: Record<string, OutcomeOdds>;
}

export interface OutcomeOdds {
  name: string;
  odds: number; // Decimal odds
  americanOdds?: string; // +150, -110
  price?: number; // For spread/total
  point?: number; // Handicap value
}

export interface Market {
  id: string;
  name: string;
  type: "prematch" | "live";
  category: "moneyline" | "spread" | "total" | "props" | "other";
}

// Health monitoring types
export interface ProviderHealth {
  provider: ProviderName;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  successRate: number; // 0-1
  averageLatency: number; // milliseconds
  errorRate: number; // 0-1
  lastSuccessTime: string | null;
  lastFailureTime: string | null;
  consecutiveFailures: number;
  rateLimitRemaining: number | null;
  rateLimitTotal: number | null;
}

export interface ProviderConfig {
  name: ProviderName;
  priority: number; // Lower = higher priority
  enabled: boolean;
  timeout: number; // milliseconds
  retryAttempts: number;
  backoffMs: number;
}

// Circuit breaker state
export interface CircuitBreakerState {
  provider: ProviderName;
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: string | null;
  nextAttemptTime: string | null;
  threshold: number; // Failures before opening
  timeoutMs: number; // How long to stay open
}

// Cache entry
export interface CachedOdds {
  data: UnifiedOdds;
  cachedAt: string;
  ttl: number; // seconds
  isStale: boolean;
}

// Error types
export class ProviderError extends Error {
  constructor(
    public provider: ProviderName,
    message: string,
    public originalError?: Error,
    public isRateLimit: boolean = false,
    public isTimeout: boolean = false
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public attemptedProviders: ProviderName[], public lastError: Error) {
    super(`All providers failed: ${attemptedProviders.join(", ")}. Last error: ${lastError.message}`);
    this.name = "AllProvidersFailedError";
    Object.setPrototypeOf(this, AllProvidersFailedError.prototype);
  }
}
