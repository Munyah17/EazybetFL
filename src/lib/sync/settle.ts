import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { betWonEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { logError } from "@/lib/log";
import type { Database } from "@/types/database";

/**
 * Settle every `open` bet whose selections have all reached a final
 * status. Pure database work -- no external API calls, so it's cheap
 * enough to run every few minutes (see /api/cron/tick), unlike the
 * scores fetch that feeds it.
 *
 * Extracted from syncScores so both the daily scores sync and the
 * frequent tick can run it. fn_settle_bet is idempotent-guarded
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
    if (!selections.every((s) => s.status !== "pending")) continue;

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
    settled++;

    const outcome = result as { status: string; payout: number } | null;
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
