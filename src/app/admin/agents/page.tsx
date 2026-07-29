import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

export default async function AdminAgentsPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, commission_rate")
    .eq("role", "agent")
    .order("full_name");

  const rows = await Promise.all(
    (agents ?? []).map(async (a) => {
      const [{ count: customerCount }, { data: commissionTx }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("assigned_agent_id", a.id),
        supabase.from("wallet_transactions").select("amount").eq("user_id", a.id).eq("type", "commission"),
      ]);
      const totalCommission = (commissionTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
      return { ...a, customerCount: customerCount ?? 0, totalCommission };
    })
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg font-bold">Agents</h1>
      <p className="text-sm text-muted-foreground">
        Read-only overview. Promotion and commission rates are managed from Super Admin.
      </p>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {rows.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email ?? a.phone}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">{a.customerCount} customers</p>
              <p className="text-xs text-muted-foreground">{Number(a.commission_rate)}% commission</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-primary">{formatMoney(a.totalCommission)}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No agents yet.</p>
        )}
      </Card>
    </div>
  );
}
