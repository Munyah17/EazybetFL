import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { syncScores } from "@/lib/sync/scores";
import { settleFromFreeScores } from "@/lib/sync/free-scores";
import { settleFromEspnScores } from "@/lib/sync/espn-scores";
import { settleResolvedBets } from "@/lib/sync/settle";
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

  // Free final-score settlement (football-data.org) -- independent of the
  // odds provider's /scores quota. Then settle any bet the grading above
  // (from either source) has now fully resolved.
  let freeScores;
  try {
    freeScores = await settleFromFreeScores(supabase);
    if (freeScores.errors.length) await logError("cron:sync-settlement", freeScores.errors.join("; "), { step: "free_scores" });
  } catch (e) {
    await logError("cron:sync-settlement", e, { step: "free_scores" });
    freeScores = { matched: 0, settled: 0, unmatched: 0, skipped: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
  // ESPN scoreboard fallback -- covers leagues the odds provider doesn't
  // grade and keeps settling when its /scores quota is exhausted.
  let espnScores;
  try {
    espnScores = await settleFromEspnScores(supabase);
    if (espnScores.errors.length) await logError("cron:sync-settlement", espnScores.errors.join("; "), { step: "espn_scores" });
  } catch (e) {
    await logError("cron:sync-settlement", e, { step: "espn_scores" });
    espnScores = { matched: 0, settled: 0, unmatched: 0, skippedLeagues: [], errors: [e instanceof Error ? e.message : String(e)] };
  }
  try {
    await settleResolvedBets(supabase);
  } catch (e) {
    await logError("cron:sync-settlement", e, { step: "settle_resolved" });
  }

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
      freeScores,
      espnScores,
      expired: expireErr ? { error: expireErr.message } : expired,
      deposits,
    },
    { status: anyFailed ? 500 : 200 }
  );
}
