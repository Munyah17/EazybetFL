import { createClient } from "@/lib/supabase/server";
import { UserManager, type ManagedUser } from "@/components/super-admin/user-manager";

export default async function UserManagementPage() {
  const supabase = await createClient();

  // Cap the initial payload -- every listed profile's row is serialized to
  // the client, so an unbounded fetch gets slow on phones as the base grows.
  // Older accounts are still reachable via search in a future pagination pass.
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, account_number, role, status, country, date_of_birth, referral_code, referred_by, assigned_agent_id, commission_rate, created_at, last_login_at"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const profileIds = (profiles ?? []).map((p) => p.id);
  const { data: wallets } = profileIds.length
    ? await supabase
        .from("wallets")
        .select("user_id, balance, principal_balance, bonus_balance, locked_balance, currency")
        .in("user_id", profileIds)
    : { data: [] };

  const walletByUser = new Map((wallets ?? []).map((w) => [w.user_id, w]));

  const users: ManagedUser[] = (profiles ?? []).map((p) => {
    const wallet = walletByUser.get(p.id);
    return {
      ...p,
      balance: wallet?.balance ?? null,
      principal_balance: wallet?.principal_balance ?? null,
      bonus_balance: wallet?.bonus_balance ?? null,
      locked_balance: wallet?.locked_balance ?? null,
      currency: wallet?.currency ?? "USD",
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="text-lg font-bold">User Management</h1>
      <UserManager initialUsers={users} />
    </div>
  );
}
