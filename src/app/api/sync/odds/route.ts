import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { oddsApi, DEFAULT_SYNC_SPORT_KEYS, type OddsApiEvent } from "@/lib/odds-api/client";
import { MARKET_NAMES } from "@/lib/odds-api/market-names";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PREFERRED_BOOKMAKERS = ["pinnacle", "bet365", "williamhill", "unibet", "betfair"];

function pickBookmaker(event: OddsApiEvent) {
  for (const key of PREFERRED_BOOKMAKERS) {
    const found = event.bookmakers.find((b) => b.key === key);
    if (found) return found;
  }
  return event.bookmakers[0] ?? null;
}

export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const keysParam = req.nextUrl.searchParams.get("keys");
  const keys = keysParam ? keysParam.split(",") : DEFAULT_SYNC_SPORT_KEYS;

  const { data: competitions, error: compErr } = await supabase
    .from("competitions")
    .select("id, odds_api_key")
    .in("odds_api_key", keys);
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  const compIdByKey = new Map(competitions!.map((c) => [c.odds_api_key, c.id]));
  const results: Record<string, number | string> = {};

  for (const key of keys) {
    const competitionId = compIdByKey.get(key);
    if (!competitionId) {
      results[key] = "no matching competition (run sync-sports first)";
      continue;
    }

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

  return NextResponse.json({ synced: results });
}
