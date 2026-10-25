import { createClient } from "@/lib/supabase/server";
import { UsersTable, type AdminUser } from "@/components/admin/users-table";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, account_number, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (users ?? []).map((u) => u.id);
  const { data: wallets } = ids.length
    ? await supabase
        .from("wallets")
        .select("user_id, balance, principal_balance, bonus_balance, locked_balance, currency")
        .in("user_id", ids)
    : { data: [] };

  const walletByUser = new Map((wallets ?? []).map((w) => [w.user_id, w]));

  const rows: AdminUser[] = (users ?? []).map((u) => {
    const w = walletByUser.get(u.id);
    return {
      ...u,
      balance: w?.balance ?? null,
      principal_balance: w?.principal_balance ?? null,
      bonus_balance: w?.bonus_balance ?? null,
      locked_balance: w?.locked_balance ?? null,
      currency: w?.currency ?? "USD",
    };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg font-bold">User Management</h1>
      <UsersTable users={rows} />
    </div>
  );
}
