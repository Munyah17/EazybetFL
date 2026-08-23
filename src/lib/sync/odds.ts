import type { SupabaseClient } from "@supabase/supabase-js";
import { oddsApi, type OddsApiEvent } from "@/lib/odds-api/client";
import { MARKET_NAMES } from "@/lib/odds-api/market-names";
import type { Database } from "@/types/database";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

const PREFERRED_BOOKMAKERS = ["pinnacle", "bet365", "williamhill", "unibet", "betfair"];

function pickBookmaker(event: OddsApiEvent) {
  for (const key of PREFERRED_BOOKMAKERS) {
    const found = event.bookmakers.find((b) => b.key === key);
    if (found) return found;
  }
  return event.bookmakers[0] ?? null;
}

export async function syncOdds(
  supabase: SupabaseClient<Database>,
  keysParam?: string | null
): Promise<Result<{ synced: Record<string, number | string> }>> {
  // Default to every competition /api/sync/sports currently marks `active`
  // (The Odds API's own in-season signal, refreshed daily) instead of a
  // hardcoded key list -- a fixed list goes stale the moment a season
  // starts or ends, which is exactly why this was only ever surfacing
  // whichever 2-3 of a ~16-key list happened to be in season. `?keys=` is
  // still honored for one-off/manual syncs of a specific competition.
  // display_order on both tables already encodes the football/big-league
  // priority built for the UI (see groupPriority/competitionPriority in
  // odds-api/client.ts) -- reusing it here too means that when the API
  // quota runs out mid-run (it does, routinely, on the current plan), it's
  // the low-priority sports that get cut off, not football.
  type Row = { id: string; odds_api_key: string; display_order: number; sport_groups: { display_order: number } | null };
  let rows: Row[];
  if (keysParam) {
    const { data, error } = await supabase
      .from("competitions")
      .select("id, odds_api_key, display_order, sport_groups ( display_order )")
      .in("odds_api_key", keysParam.split(","));
    if (error) return { ok: false, error: error.message, status: 500 };
    rows = (data ?? []) as unknown as Row[];
  } else {
    const { data, error } = await supabase
      .from("competitions")
      .select("id, odds_api_key, display_order, sport_groups ( display_order )")
      .eq("active", true);
    if (error) return { ok: false, error: error.message, status: 500 };
    rows = (data ?? []) as unknown as Row[];
  }
  rows.sort((a, b) => {
    const groupDiff = (a.sport_groups?.display_order ?? 999) - (b.sport_groups?.display_order ?? 999);
    return groupDiff !== 0 ? groupDiff : a.display_order - b.display_order;
  });

  const compIdByKey = new Map(rows.map((c) => [c.odds_api_key, c.id]));
  const keys = rows.map((c) => c.odds_api_key);
  const results: Record<string, number | string> = {};

  for (const key of keys) {
    const competitionId = compIdByKey.get(key)!;

    let events: OddsApiEvent[];
    try {
      events = await oddsApi.getOdds(key);
    } catch (e) {
      results[key] = `fetch failed: ${(e as Error).message}`;
      continue;
    }
    if (events.length === 0) {
      results[key] = 0;
      continue;
    }

    const now = new Date();

    // 1. Bulk upsert all fixtures for this competition in one round trip.
    const fixtureRows = events.map((event) => ({
      competition_id: competitionId,
      odds_api_event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
      status: (new Date(event.commence_time) <= now ? "live" : "upcoming") as "live" | "upcoming",
      last_synced_at: new Date().toISOString(),
    }));

    const { data: fixtures, error: fixturesErr } = await supabase
      .from("fixtures")
      .upsert(fixtureRows, { onConflict: "odds_api_event_id" })
      .select("id, odds_api_event_id");
    if (fixturesErr || !fixtures) {
      results[key] = `fixtures upsert failed: ${fixturesErr?.message}`;
      continue;
    }
    const fixtureIdByEventId = new Map(fixtures.map((f) => [f.odds_api_event_id, f.id]));

    // 2. Bulk upsert all markets for all of this competition's fixtures.
    type MarketRow = { fixture_id: string; market_key: string; market_name: string; status: "open" };
    const marketRows: MarketRow[] = [];
    for (const event of events) {
      const fixtureId = fixtureIdByEventId.get(event.id);
      const bookmaker = pickBookmaker(event);
      if (!fixtureId || !bookmaker) continue;
      for (const market of bookmaker.markets) {
        marketRows.push({
          fixture_id: fixtureId,
          market_key: market.key,
          market_name: MARKET_NAMES[market.key] ?? market.key,
          status: "open",
        });
      }
    }

    let marketIdByFixtureAndKey = new Map<string, string>();
    if (marketRows.length) {
      const { data: markets, error: marketsErr } = await supabase
        .from("markets")
        .upsert(marketRows, { onConflict: "fixture_id,market_key" })
        .select("id, fixture_id, market_key");
      if (marketsErr || !markets) {
        results[key] = `markets upsert failed: ${marketsErr?.message}`;
        continue;
      }
      marketIdByFixtureAndKey = new Map(markets.map((m) => [`${m.fixture_id}:${m.market_key}`, m.id]));
    }

    // 3. Replace odds_outcomes for every market touched: one bulk delete + one bulk insert.
    const marketIds = Array.from(marketIdByFixtureAndKey.values());
    if (marketIds.length) {
      await supabase.from("odds_outcomes").delete().in("market_id", marketIds);
    }

    const outcomeRows: {
      market_id: string;
      bookmaker: string;
      name: string;
      point: number | null;
      price: number;
      display_order: number;
    }[] = [];
    for (const event of events) {
      const fixtureId = fixtureIdByEventId.get(event.id);
      const bookmaker = pickBookmaker(event);
      if (!fixtureId || !bookmaker) continue;
      for (const market of bookmaker.markets) {
        const marketId = marketIdByFixtureAndKey.get(`${fixtureId}:${market.key}`);
        if (!marketId) continue;
        market.outcomes.forEach((o, i) => {
          outcomeRows.push({
            market_id: marketId,
            bookmaker: "eazybet",
            name: o.name,
            point: o.point ?? null,
            price: o.price,
            display_order: i,
          });
        });
      }
    }

    if (outcomeRows.length) {
      // Upsert rather than plain insert: the preceding delete isn't atomic
      // with this insert across two overlapping requests, so if a race
      // does happen this still can't create duplicate rows -- the unique
      // constraint on (market_id, name, point) turns a would-be duplicate
      // into an update instead.
      const { error: outcomesErr } = await supabase
        .from("odds_outcomes")
        .upsert(outcomeRows, { onConflict: "market_id,name,point" });
      if (outcomesErr) {
        results[key] = `odds_outcomes upsert failed: ${outcomesErr.message}`;
        continue;
      }
    }

    results[key] = fixtures.length;
  }

  return { ok: true, data: { synced: results } };
}
