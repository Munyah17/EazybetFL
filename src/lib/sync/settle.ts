import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { betWonEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { logError } from "@/lib/log";
import type { Database } from "@/types/database";

/**
 * Settle every `open` bet whose outcome is already decided. A ticket is
 * decided the moment ANY leg loses (single/multiple) or a system bet can
 * no longer reach its required winners -- the global standard: one lost
 * leg renders the whole betslip lost even if other games haven't started.
 * Fully-resolved tickets settle too, of course.
 *
 * Pure database work -- no external API calls, so it's cheap enough to
 * run every few minutes (see /api/cron/tick), unlike the scores fetch
 * that feeds it. fn_settle_bet is idempotent-guarded
 * (`BET_ALREADY_SETTLED`), so overlapping runs are safe.
 */
export async function settleResolvedBets(
  supabase: SupabaseClient<Database>
): Promise<{ settled: number; errors: string[] }> {
  const errors: string[] = [];
  let settled = 0;

  const { data: openBets, error } = await supabase
    .from("bets")
    .select("id, bet_type, profiles(email)")
    .eq("status", "open");
  if (error) return { settled: 0, errors: [error.message] };

  for (const bet of openBets ?? []) {
    const { data: selections } = await supabase
      .from("bet_selections")
      .select("status")
      .eq("bet_id", bet.id);
    if (!selections?.length) continue;
    // Worth a settle attempt when every leg is resolved OR any leg lost
    // (fn_settle_bet decides whether a system ticket is actually dead and
    // returns 'open' harmlessly when it isn't).
    const anyLost = selections.some((s) => s.status === "lost");
    const allResolved = selections.every((s) => s.status !== "pending");
    if (!anyLost && !allResolved) continue;

    const { data: result, error: settleErr } = await supabase.rpc("fn_settle_bet", { p_bet_id: bet.id });
    if (settleErr) {
      // A bet another run already settled races to `BET_ALREADY_SETTLED` --
      // that's expected, not a real error worth logging noisily.
      if (!settleErr.message.includes("BET_ALREADY_SETTLED")) {
        errors.push(`${bet.id}: ${settleErr.message}`);
        await logError("sync:settle", settleErr.message, { betId: bet.id });
      }
      continue;
    }
    const outcome = result as { status: string; payout: number } | null;
    if (!outcome || outcome.status === "open") continue; // not actually decided yet
    settled++;

    const email = bet.profiles?.email;
    if (outcome?.status === "won" && outcome.payout > 0 && email) {
      try {
        await sendEmail(email, "You won! 🎉", betWonEmail(formatMoney(outcome.payout), bet.bet_type));
      } catch (e) {
        await logError("sync:settle", e, { betId: bet.id, step: "won_email" });
      }
    }
  }

  return { settled, errors };
}

/**
 * Fixtures stuck in `live`/`upcoming` long after kickoff because the
 * scores feed never delivered a result. Any that carry no pending bet
 * selections are pure stale display data -- flip them to `finished` so
 * they stop showing on the Live page and in fixture lists. Fixtures that
 * DO have unsettled bets are left alone for manual settlement
 * (/admin/settlement) -- marking them finished would strand those bets.
 */
export async function cleanupStaleFixtures(
  supabase: SupabaseClient<Database>
): Promise<{ cleaned: number }> {
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("fixtures")
    .select("id")
    .in("status", ["live", "upcoming"])
    .lt("commence_time", cutoff)
    .limit(500);
  if (!stale?.length) return { cleaned: 0 };

  let cleaned = 0;
  for (const f of stale) {
    const { count } = await supabase
      .from("bet_selections")
      .select("id", { count: "exact", head: true })
      .eq("fixture_id", f.id)
      .eq("status", "pending");
    if (count && count > 0) continue; // has unsettled bets -- leave for manual settlement
    const { error } = await supabase.from("fixtures").update({ status: "finished" }).eq("id", f.id);
    if (!error) cleaned++;
  }
  return { cleaned };
}
