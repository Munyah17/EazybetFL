import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { oddsApi, EXTRA_MARKET_KEYS } from "@/lib/odds-api/client";
import { MARKET_NAMES } from "@/lib/odds-api/market-names";
import type { FixtureWithOdds } from "@/lib/data/fixture-types";

const TTL_MS = 60 * 60 * 1000; // throttle repeat per-event API calls to once/hour/fixture
const BULK_MARKET_KEYS = new Set(["h2h", "spreads", "totals"]);

/**
 * Fetches "additional markets" (both teams to score, double chance, draw no
 * bet, alternate handicap/totals lines) for a single fixture from The Odds
 * API's per-event endpoint -- the only one that offers them on our plan.
 * That endpoint costs quota per market x region, so this is deliberately
 * on-demand (called when someone opens the match page) and throttled per
 * fixture, never bulk-synced across every fixture.
 */
export async function ensureExtraMarkets(fixture: FixtureWithOdds): Promise<void> {
  if (!fixture.odds_api_event_id || !fixture.competition) return;
  if (fixture.status === "finished" || fixture.status === "cancelled") return;
  if (fixture.extra_markets_synced_at) {
    const age = Date.now() - new Date(fixture.extra_markets_synced_at).getTime();
    if (age < TTL_MS) return;
  }

  const supabase = createAdminClient();

  let event;
  try {
    event = await oddsApi.getEventOdds(
      fixture.competition.odds_api_key,
      fixture.odds_api_event_id,
      EXTRA_MARKET_KEYS
    );
  } catch {
    return; // best-effort enrichment -- never break the page over this
  }

  // Mark attempted regardless of outcome so a market-less fixture (some
  // bookmakers just don't price these for lower-tier fixtures) doesn't get
  // re-requested on every page view within the TTL window.
  await supabase
    .from("fixtures")
    .update({ extra_markets_synced_at: new Date().toISOString() })
    .eq("id", fixture.id);

  let bookmaker = null;
  let bestCount = -1;
  for (const bm of event.bookmakers) {
    const count = bm.markets.filter((m) => m.key in MARKET_NAMES && !BULK_MARKET_KEYS.has(m.key)).length;
    if (count > bestCount) {
      bookmaker = bm;
      bestCount = count;
    }
  }
  if (!bookmaker || bestCount <= 0) return;

  for (const market of bookmaker.markets) {
    if (BULK_MARKET_KEYS.has(market.key) || !(market.key in MARKET_NAMES)) continue;

    const { data: marketRow, error: marketErr } = await supabase
      .from("markets")
      .upsert(
        { fixture_id: fixture.id, market_key: market.key, market_name: MARKET_NAMES[market.key], status: "open" },
        { onConflict: "fixture_id,market_key" }
      )
      .select("id")
      .single();
    if (marketErr || !marketRow) continue;

    await supabase.from("odds_outcomes").delete().eq("market_id", marketRow.id);
    const rows = market.outcomes.map((o, i) => ({
      market_id: marketRow.id,
      bookmaker: "eazybet",
      name: o.name,
      point: o.point ?? null,
      price: o.price,
      display_order: i,
    }));
    // Upsert, not plain insert -- see sync/odds/route.ts for why (the
    // delete above isn't atomic with this write across overlapping calls).
    if (rows.length) {
      await supabase.from("odds_outcomes").upsert(rows, { onConflict: "market_id,name,point" });
    }
  }
}
