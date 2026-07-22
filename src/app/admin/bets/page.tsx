import { createClient } from "@/lib/supabase/server";
import { AdminBetRow } from "@/components/admin/admin-bet-row";

export default async function AdminBetsPage() {
  const supabase = await createClient();
  const { data: bets } = await supabase
    .from("bets")
    .select(
      `id, bet_type, stake, total_odds, potential_payout, status, placed_at,
       profiles ( full_name ),
       bet_selections ( id, selection_name, market_name, fixture_label, odds_price, status )`
    )
    .order("placed_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg font-bold">Bets</h1>
      <div className="flex flex-col gap-2">
        {(bets ?? []).map((bet) => (
          <AdminBetRow key={bet.id} bet={bet} />
        ))}
        {!bets?.length && <p className="py-10 text-center text-sm text-muted-foreground">No bets yet.</p>}
      </div>
    </div>
  );
}
