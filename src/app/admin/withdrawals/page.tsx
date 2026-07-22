import { createClient } from "@/lib/supabase/server";
import { WithdrawalRow } from "@/components/admin/withdrawal-row";

export default async function AdminWithdrawalsPage() {
  const supabase = await createClient();
  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("id, amount, method, status, destination, requested_at, profiles!user_id ( full_name )")
    .order("requested_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-lg font-bold">Withdrawal Queue</h1>
      <div className="flex flex-col gap-2">
        {(withdrawals ?? []).map((w) => (
          <WithdrawalRow key={w.id} withdrawal={w} />
        ))}
        {!withdrawals?.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">No withdrawal requests.</p>
        )}
      </div>
    </div>
  );
}
