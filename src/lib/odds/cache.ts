/**
 * Caching strategy for odds data using Supabase
 * Reduces API calls and provides fallback when providers fail
 */

import { createClient } from "@supabase/supabase-js";
import type { CachedOdds, UnifiedOdds } from "@/types/odds";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase credentials not configured for odds caching");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CACHE_TABLE = "odds_cache";

// TTL in seconds
const TTL_PREMATCH = 3600; // 1 hour for prematch odds
const TTL_LIVE = 30; // 30 seconds for live odds
const TTL_STALE = 300; // 5 minutes for stale fallback

export async function getCachedOdds(
  matchId: string
): Promise<CachedOdds | null> {
  const { data, error } = await supabase
    .from(CACHE_TABLE)
    .select("*")
    .eq("match_id", matchId)
    .single();

  if (error || !data) {
    return null;
  }

  const cachedAt = new Date(data.cached_at).getTime();
  const now = Date.now();
  const ageSeconds = (now - cachedAt) / 1000;
  const isStale = ageSeconds > data.ttl;

  return {
    data: data.data as UnifiedOdds,
    cachedAt: data.cached_at,
    ttl: data.ttl,
    isStale,
  };
}

export async function setCachedOdds(
  matchId: string,
  odds: UnifiedOdds,
  isLive: boolean = false
): Promise<void> {
  const ttl = isLive ? TTL_LIVE : TTL_PREMATCH;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const { error } = await supabase
    .from(CACHE_TABLE)
    .upsert({
      match_id: matchId,
      data: odds,
      cached_at: new Date().toISOString(),
      ttl,
      expires_at: expiresAt,
      is_live: isLive,
    });

  if (error) {
    console.error("Failed to cache odds:", error);
  }
}

export async function getStaleOdds(
  matchId: string
): Promise<CachedOdds | null> {
  const { data, error } = await supabase
    .from(CACHE_TABLE)
    .select("*")
    .eq("match_id", matchId)
    .single();

  if (error || !data) {
    return null;
  }

  const cachedAt = new Date(data.cached_at).getTime();
  const now = Date.now();
  const ageSeconds = (now - cachedAt) / 1000;

  // Return as stale if within stale TTL window
  if (ageSeconds > data.ttl && ageSeconds <= TTL_STALE) {
    return {
      data: data.data as UnifiedOdds,
      cachedAt: data.cached_at,
      ttl: data.ttl,
      isStale: true,
    };
  }

  return null;
}

export async function invalidateCache(matchId: string): Promise<void> {
  const { error } = await supabase
    .from(CACHE_TABLE)
    .delete()
    .eq("match_id", matchId);

  if (error) {
    console.error("Failed to invalidate cache:", error);
  }
}

export async function clearExpiredCache(): Promise<void> {
  const { error } = await supabase
    .from(CACHE_TABLE)
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("Failed to clear expired cache:", error);
  }
}

export async function getCacheStats(): Promise<{
  total: number;
  live: number;
  prematch: number;
  expired: number;
}> {
  const { data, error } = await supabase
    .from(CACHE_TABLE)
    .select("is_live, expires_at");

  if (error || !data) {
    return { total: 0, live: 0, prematch: 0, expired: 0 };
  }

  const now = Date.now();
  let live = 0;
  let prematch = 0;
  let expired = 0;

  for (const item of data) {
    const expiresAt = new Date(item.expires_at).getTime();
    if (expiresAt < now) {
      expired++;
    } else if (item.is_live) {
      live++;
    } else {
      prematch++;
    }
  }

  return {
    total: data.length,
    live,
    prematch,
    expired,
  };
}
