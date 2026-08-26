import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { syncScores } from "@/lib/sync/scores";
import { reconcileStuckDeposits } from "@/lib/sync/deposits";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Combines scores sync (which settles bets) + booking-code expiry +
 * stuck-deposit reconciliation into one cron-triggered request, for the
 * same Hobby-plan 2-job-limit reason as /api/cron/sync-catalog.
 *
 * These three steps are independent -- unlike sync-catalog's sports->odds
 * dependency, nothing here depends on anything else succeeding. They used to
 * short-circuit on the first failure, which meant a scores-sync hiccup
 * silently skipped stuck-deposit reconciliation (a money-critical safety
 * net) for the rest of the day. Each step now runs regardless of the
 * others' outcome, and every failure is logged, not just returned in a
 * response nobody's watching. */
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  const scores = await syncScores(supabase);
  if (!scores.ok) await logError("cron:sync-settlement", scores.error, { step: "scores" });

  const { data: expired, error: expireErr } = await supabase.rpc("fn_expire_booked_bets");
  if (expireErr) await logError("cron:sync-settlement", expireErr.message, { step: "expire_booked_bets" });

  let deposits;
  try {
    deposits = await reconcileStuckDeposits(supabase);
    if (deposits.errors.length > 0) {
      await logError("cron:sync-settlement", deposits.errors.join("; "), { step: "reconcile_deposits" });
    }
  } catch (e) {
    await logError("cron:sync-settlement", e, { step: "reconcile_deposits" });
    deposits = { checked: 0, completed: 0, failed: 0, errors: [e instanceof Error ? e.message : String(e)] };
  }

  const anyFailed = !scores.ok || Boolean(expireErr) || deposits.errors.length > 0;

  // Non-2xx on any partial failure, even though most of the run may have
  // succeeded -- Vercel's own cron dashboard surfaces non-2xx invocations,
  // which is a second, independent place this becomes visible beyond our
  // own system_logs.
  return NextResponse.json(
    {
      scores: scores.ok ? scores.data : { error: scores.error },
      expired: expireErr ? { error: expireErr.message } : expired,
      deposits,
    },
    { status: anyFailed ? 500 : 200 }
  );
}
