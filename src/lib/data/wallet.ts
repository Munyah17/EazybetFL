import { createClient } from "@/lib/supabase/server";

export async function getWalletSummary(userId: string) {
  const supabase = await createClient();

  const [{ data: wallet }, { data: deposits }, { data: withdrawals }, { data: transactions }] =
    await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", userId).single(),
      supabase.from("deposits").select("amount").eq("user_id", userId).eq("status", "completed"),
      supabase.from("withdrawals").select("amount").eq("user_id", userId).eq("status", "completed"),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const totalDeposits = (deposits ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  const totalWithdrawals = (withdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);

  return {
    wallet,
    totalDeposits,
    totalWithdrawals,
    transactions: transactions ?? [],
  };
}
