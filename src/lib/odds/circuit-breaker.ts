/**
 * Circuit breaker pattern for API provider failover
 * Prevents cascading failures by temporarily blocking failing providers
 */

import type { CircuitBreakerState, ProviderName } from "@/types/odds";

// Circuit breaker state (persists for serverless instance lifetime)
const circuitBreakers: Map<ProviderName, CircuitBreakerState> = new Map();

// Default configuration
const DEFAULT_THRESHOLD = 5; // Failures before opening
const DEFAULT_TIMEOUT_MS = 60000; // 1 minute before trying again

function getCircuitBreaker(
  provider: ProviderName,
  threshold: number = DEFAULT_THRESHOLD,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): CircuitBreakerState {
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, {
      provider,
      state: "closed",
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null,
      threshold,
      timeoutMs,
    });
  }
  return circuitBreakers.get(provider)!;
}

export function recordFailure(provider: ProviderName): void {
  const cb = getCircuitBreaker(provider);
  cb.failureCount++;
  cb.lastFailureTime = new Date().toISOString();

  if (cb.failureCount >= cb.threshold) {
    cb.state = "open";
    cb.nextAttemptTime = new Date(Date.now() + cb.timeoutMs).toISOString();
  }

  circuitBreakers.set(provider, cb);
}

export function recordSuccess(provider: ProviderName): void {
  const cb = getCircuitBreaker(provider);
  cb.failureCount = 0;
  cb.state = "closed";
  cb.lastFailureTime = null;
  cb.nextAttemptTime = null;
  circuitBreakers.set(provider, cb);
}

export function canAttemptRequest(provider: ProviderName): boolean {
  const cb = getCircuitBreaker(provider);

  // If closed, allow request
  if (cb.state === "closed") {
    return true;
  }

  // If open, check if timeout has elapsed
  if (cb.state === "open") {
    if (!cb.nextAttemptTime) {
      return false;
    }
    const now = Date.now();
    const nextAttempt = new Date(cb.nextAttemptTime).getTime();
    if (now >= nextAttempt) {
      // Transition to half-open
      cb.state = "half-open";
      circuitBreakers.set(provider, cb);
      return true;
    }
    return false;
  }

  // If half-open, allow one request to test
  return true;
}

export function getState(provider: ProviderName): CircuitBreakerState {
  return getCircuitBreaker(provider);
}

export function getAllStates(): CircuitBreakerState[] {
  return Array.from(circuitBreakers.values());
}

export function resetCircuitBreaker(provider: ProviderName): void {
  circuitBreakers.delete(provider);
}

export function isCircuitOpen(provider: ProviderName): boolean {
  const cb = getCircuitBreaker(provider);
  return cb.state === "open";
}

export function getTimeUntilNextAttempt(provider: ProviderName): number | null {
  const cb = getCircuitBreaker(provider);
  if (cb.state !== "open" || !cb.nextAttemptTime) {
    return null;
  }
  const now = Date.now();
  const nextAttempt = new Date(cb.nextAttemptTime).getTime();
  return Math.max(0, nextAttempt - now);
}
