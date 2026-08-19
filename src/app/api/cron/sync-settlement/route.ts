import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { syncScores } from "@/lib/sync/scores";
import { reconcileStuckDeposits } from "@/lib/sync/deposits";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Combines scores sync (which settles bets) + booking-code expiry +
 * stuck-deposit reconciliation into one cron-triggered request, for the
 * same Hobby-plan 2-job-limit reason as /api/cron/sync-catalog. */
export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  const scores = await syncScores(supabase);
  if (!scores.ok) {
    return NextResponse.json({ scores: { error: scores.error } }, { status: scores.status });
  }

  const { data: expired, error: expireErr } = await supabase.rpc("fn_expire_booked_bets");
  if (expireErr) {
    return NextResponse.json({ scores: scores.data, expired: { error: expireErr.message } }, { status: 500 });
  }

  const deposits = await reconcileStuckDeposits(supabase);

  return NextResponse.json({ scores: scores.data, expired, deposits });
}
