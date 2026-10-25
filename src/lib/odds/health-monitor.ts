/**
 * Health monitoring system for odds API providers
 * Tracks success rates, latency, error rates, and rate limits
 */

import type { ProviderHealth, ProviderName } from "@/types/odds";

// In-memory health state (persists for serverless instance lifetime)
const healthStore: Map<ProviderName, ProviderHealth> = new Map();

// Request history for calculating metrics (last 100 requests per provider)
const requestHistory: Map<ProviderName, number[]> = new Map();
const successHistory: Map<ProviderName, boolean[]> = new Map();

const MAX_HISTORY_SIZE = 100;

function getProviderHealth(provider: ProviderName): ProviderHealth {
  if (!healthStore.has(provider)) {
    healthStore.set(provider, {
      provider,
      status: "unknown",
      successRate: 1,
      averageLatency: 0,
      errorRate: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      consecutiveFailures: 0,
      rateLimitRemaining: null,
      rateLimitTotal: null,
    });
  }
  return healthStore.get(provider)!;
}

function recordRequest(provider: ProviderName, latency: number, success: boolean) {
  // Update request history
  const history = requestHistory.get(provider) || [];
  history.push(latency);
  if (history.length > MAX_HISTORY_SIZE) history.shift();
  requestHistory.set(provider, history);

  // Update success history
  const successes = successHistory.get(provider) || [];
  successes.push(success);
  if (successes.length > MAX_HISTORY_SIZE) successes.shift();
  successHistory.set(provider, successes);

  // Calculate metrics
  const health = getProviderHealth(provider);
  
  // Average latency
  const avgLatency = history.reduce((a, b) => a + b, 0) / history.length;
  health.averageLatency = Math.round(avgLatency);

  // Success rate
  const successCount = successes.filter((s) => s).length;
  health.successRate = successCount / successes.length;
  health.errorRate = 1 - health.successRate;

  // Update timestamps
  if (success) {
    health.lastSuccessTime = new Date().toISOString();
    health.consecutiveFailures = 0;
  } else {
    health.lastFailureTime = new Date().toISOString();
    health.consecutiveFailures++;
  }

  // Determine status
  if (health.consecutiveFailures >= 5) {
    health.status = "unhealthy";
  } else if (health.successRate < 0.5 || health.errorRate > 0.5) {
    health.status = "degraded";
  } else if (health.successRate >= 0.9) {
    health.status = "healthy";
  } else {
    health.status = "degraded";
  }

  healthStore.set(provider, health);
}

export function recordSuccess(provider: ProviderName, latency: number) {
  recordRequest(provider, latency, true);
}

export function recordFailure(provider: ProviderName, latency: number, error?: Error) {
  recordRequest(provider, latency, false);
}

export function getHealth(provider: ProviderName): ProviderHealth {
  return getProviderHealth(provider);
}

export function getAllHealth(): ProviderHealth[] {
  return Array.from(healthStore.values());
}

export function isProviderHealthy(provider: ProviderName): boolean {
  const health = getProviderHealth(provider);
  return health.status === "healthy" || health.status === "unknown";
}

export function updateRateLimit(
  provider: ProviderName,
  remaining: number | null,
  total: number | null
) {
  const health = getProviderHealth(provider);
  health.rateLimitRemaining = remaining;
  health.rateLimitTotal = total;
  healthStore.set(provider, health);
}

export function isRateLimitImminent(provider: ProviderName, threshold: number = 0.2): boolean {
  const health = getProviderHealth(provider);
  if (health.rateLimitRemaining === null || health.rateLimitTotal === null) {
    return false;
  }
  const usageRatio = health.rateLimitRemaining / health.rateLimitTotal;
  return usageRatio <= threshold;
}

export function resetHealth(provider: ProviderName) {
  healthStore.delete(provider);
  requestHistory.delete(provider);
  successHistory.delete(provider);
}
