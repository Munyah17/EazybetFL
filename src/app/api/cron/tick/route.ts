import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { reconcileStuckDeposits } from "@/lib/sync/deposits";
import { settleResolvedBets, cleanupStaleFixtures } from "@/lib/sync/settle";
import { settleFromFreeScores } from "@/lib/sync/free-scores";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * High-frequency heartbeat -- meant to run every few minutes from an
 * external scheduler (GitHub Actions), because Vercel's Hobby plan only
 * triggers vercel.json crons once a day.
 *
 * Does NOT call the odds provider (that burns quota and belongs on the
 * daily /api/cron/sync-catalog job). It DOES pull free final scores from
 * football-data.org for settlement -- that's a separate, free feed.
 *
 *   - re-verify stuck Paynow/EcoCash deposits against the gateway
 *   - auto-settle fixtures against free final scores
 *   - settle any bet whose selections are all now resolved
 *   - expire lapsed booking codes
 *   - retire stale live/upcoming fixtures with no open bets
 *
 * Every step runs regardless of the others' outcome; failures are logged.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  let deposits: Awaited<ReturnType<typeof reconcileStuckDeposits>> | { error: string };
  try {
    deposits = await reconcileStuckDeposits(supabase);
    if (deposits.errors.length) await logError("cron:tick", deposits.errors.join("; "), { step: "deposits" });
  } catch (e) {
    await logError("cron:tick", e, { step: "deposits" });
    deposits = { error: e instanceof Error ? e.message : String(e) };
  }

  let scores: Awaited<ReturnType<typeof settleFromFreeScores>> | { error: string };
  try {
    scores = await settleFromFreeScores(supabase);
    if (scores.errors.length) await logError("cron:tick", scores.errors.join("; "), { step: "free_scores" });
  } catch (e) {
    await logError("cron:tick", e, { step: "free_scores" });
    scores = { error: e instanceof Error ? e.message : String(e) };
  }

  let bets: Awaited<ReturnType<typeof settleResolvedBets>> | { error: string };
  try {
    bets = await settleResolvedBets(supabase);
    if (bets.errors.length) await logError("cron:tick", bets.errors.join("; "), { step: "settle" });
  } catch (e) {
    await logError("cron:tick", e, { step: "settle" });
    bets = { error: e instanceof Error ? e.message : String(e) };
  }

  let expired: number | { error: string };
  try {
    const { data, error } = await supabase.rpc("fn_expire_booked_bets");
    if (error) throw new Error(error.message);
    expired = data ?? 0;
  } catch (e) {
    await logError("cron:tick", e, { step: "expire_booked_bets" });
    expired = { error: e instanceof Error ? e.message : String(e) };
  }

  let fixtures: Awaited<ReturnType<typeof cleanupStaleFixtures>> | { error: string };
  try {
    fixtures = await cleanupStaleFixtures(supabase);
  } catch (e) {
    await logError("cron:tick", e, { step: "cleanup_stale_fixtures" });
    fixtures = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ deposits, scores, bets, expired, fixtures });
}
