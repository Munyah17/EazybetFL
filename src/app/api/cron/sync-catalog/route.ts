import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { syncSports } from "@/lib/sync/sports";
import { syncOdds } from "@/lib/sync/odds";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Combines sports + odds sync into one cron-triggered request. Vercel's
 * free/Hobby plan caps a project at 2 cron jobs total (and throttles
 * everything to at most once a day regardless of the schedule you set) --
 * the individual /api/sync/{sports,odds,scores} routes still exist and
 * work standalone for manual/one-off syncs, but only these two combined
 * endpoints are wired into vercel.json's cron schedule. */
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  const sports = await syncSports(supabase);
  if (!sports.ok) {
    await logError("cron:sync-catalog", sports.error, { step: "sports" });
    return NextResponse.json({ sports: { error: sports.error } }, { status: sports.status });
  }

  // Odds sync depends on the competitions sports sync just wrote, so it's a
  // real sequential dependency (unlike sync-settlement's three steps, which
  // are independent and must not short-circuit each other).
  const odds = await syncOdds(supabase);
  if (!odds.ok) {
    await logError("cron:sync-catalog", odds.error, { step: "odds" });
    return NextResponse.json({ sports: sports.data, odds: { error: odds.error } }, { status: odds.status });
  }

  return NextResponse.json({ sports: sports.data, odds: odds.data });
}
