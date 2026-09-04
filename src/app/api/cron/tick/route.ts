import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { reconcileStuckDeposits } from "@/lib/sync/deposits";
import { settleResolvedBets } from "@/lib/sync/settle";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * High-frequency heartbeat -- meant to run every few minutes from an
 * external scheduler (GitHub Actions), because Vercel's Hobby plan only
 * triggers vercel.json crons once a day.
 *
 * Deliberately does NO external sports-API calls (those burn The Odds API
 * quota and belong on the daily /api/cron/sync-* jobs). Only the cheap,
 * time-sensitive work:
 *   - re-verify stuck Paynow/EcoCash deposits against the gateway
 *   - settle any bet whose selections are all now resolved
 *   - expire lapsed booking codes
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

  return NextResponse.json({ deposits, bets, expired });
}
