import { createClient } from "@/lib/supabase/server";

const BET_SELECT = `
  id, bet_type, system_size, stake, total_odds, winboost_enabled, potential_payout,
  status, cash_out_value, placed_at, settled_at, cashed_out_at,
  bet_selections ( id, selection_name, market_name, fixture_label, odds_price, status )
`;

export async function getBets(userId: string, statusFilter?: "open" | "settled" | "cashed_out") {
  const supabase = await createClient();
  let query = supabase
    .from("bets")
    .select(BET_SELECT)
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });

  if (statusFilter === "open") query = query.eq("status", "open");
  else if (statusFilter === "cashed_out")
    query = query.in("status", ["cashed_out", "partially_cashed_out"]);
  else if (statusFilter === "settled") query = query.in("status", ["won", "lost", "void"]);

  const { data, error } = await query.limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type BetRow = Awaited<ReturnType<typeof getBets>>[number];
