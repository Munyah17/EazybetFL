import { createClient } from "@/lib/supabase/server";
import { CustomerRow } from "@/components/agent/customer-row";

export default async function AgentCustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: customers } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email")
    .eq("assigned_agent_id", user!.id)
    .order("full_name");

  const customerIds = (customers ?? []).map((c) => c.id);
  const { data: wallets } = customerIds.length
    ? await supabase.from("wallets").select("user_id, balance, principal_balance").in("user_id", customerIds)
    : { data: [] };
  const balanceByUserId = new Map(
    (wallets ?? []).map((w) => [w.user_id, Number(w.balance) + Number(w.principal_balance)])
  );

  const rows = (customers ?? []).map((c) => ({ ...c, balance: balanceByUserId.get(c.id) ?? 0 }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold">My Customers</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No customers yet. Share your agent code (your referral code, from Account &rarr; Refer &amp;
          Earn) with customers so they can link to you from their Wallet page.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((c) => (
            <CustomerRow key={c.id} customer={c} />
          ))}
        </div>
      )}
    </div>
  );
}
