import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatMoney } from "@/lib/format";

/** Checked server-side by both deposit routes before starting a payment.
 * Returns a user-facing message if the deposit should be blocked, or null
 * to proceed. */
export async function checkResponsibleGamblingLimits(
  supabase: SupabaseClient<Database>,
  userId: string,
  amount: number
): Promise<string | null> {
  const { data: settings } = await supabase
    .from("responsible_gambling_settings")
    .select("self_exclusion_until, daily_deposit_limit")
    .eq("user_id", userId)
    .maybeSingle();

  if (settings?.self_exclusion_until && new Date(settings.self_exclusion_until) > new Date()) {
    return "Your account is currently self-excluded from depositing.";
  }

  if (settings?.daily_deposit_limit) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: todaysDeposits } = await supabase
      .from("deposits")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", startOfDay.toISOString());

    const todayTotal = (todaysDeposits ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
    if (todayTotal + amount > settings.daily_deposit_limit) {
      return `This would exceed your daily deposit limit of ${formatMoney(settings.daily_deposit_limit)}.`;
    }
  }

  return null;
}
