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

  // syncSports/syncOdds THROW on provider failure (e.g. every odds key's
  // monthly quota exhausted -- a routine condition on the current plan, not
  // an exception). An uncaught throw here produced a bare 500 that never
  // reached system_logs, so the failure was invisible except as a rejected
  // call on the scheduler's side.
  let sports: Awaited<ReturnType<typeof syncSports>>;
  try {
    sports = await syncSports(supabase);
  } catch (e) {
    await logError("cron:sync-catalog", e, { step: "sports" });
    return NextResponse.json({ sports: { error: e instanceof Error ? e.message : String(e) } }, { status: 500 });
  }
  if (!sports.ok) {
    await logError("cron:sync-catalog", sports.error, { step: "sports" });
    return NextResponse.json({ sports: { error: sports.error } }, { status: sports.status });
  }

  // Odds sync depends on the competitions sports sync just wrote, so it's a
  // real sequential dependency (unlike sync-settlement's three steps, which
  // are independent and must not short-circuit each other).
  let odds: Awaited<ReturnType<typeof syncOdds>>;
  try {
    odds = await syncOdds(supabase);
  } catch (e) {
    await logError("cron:sync-catalog", e, { step: "odds" });
    return NextResponse.json({ sports: sports.data, odds: { error: e instanceof Error ? e.message : String(e) } }, { status: 500 });
  }
  if (!odds.ok) {
    await logError("cron:sync-catalog", odds.error, { step: "odds" });
    return NextResponse.json({ sports: sports.data, odds: { error: odds.error } }, { status: odds.status });
  }

  return NextResponse.json({ sports: sports.data, odds: odds.data });
}
