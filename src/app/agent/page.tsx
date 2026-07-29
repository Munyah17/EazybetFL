import Link from "next/link";
import { Wallet, Percent, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export default async function AgentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: wallet }, { data: commissionTx }, { count: customerCount }] =
    await Promise.all([
      supabase.from("profiles").select("commission_rate").eq("id", user!.id).single(),
      supabase.from("wallets").select("balance").eq("user_id", user!.id).single(),
      supabase.from("wallet_transactions").select("amount").eq("user_id", user!.id).eq("type", "commission"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("assigned_agent_id", user!.id),
    ]);

  const totalCommission = (commissionTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0);

  const stats = [
    { label: "Float Balance", value: formatMoney(wallet?.balance ?? 0), icon: Wallet },
    { label: "Commission Rate", value: `${Number(profile?.commission_rate ?? 0)}%`, icon: Percent },
    { label: "Total Commission Earned", value: formatMoney(totalCommission), icon: TrendingUp },
    { label: "Customers", value: String(customerCount ?? 0), icon: Users },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="gap-1 border-border/60 bg-card p-4">
            <s.icon className="size-5 text-primary" />
            <p className="text-xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="items-center gap-2 border-border/60 bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Top up your float to fund cash deposits for your customers.
        </p>
        <Button asChild>
          <Link href="/wallet/deposit">Top Up Float</Link>
        </Button>
      </Card>

      <Link href="/agent/customers">
        <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
          <Users className="size-5 text-primary" />
          <span className="text-xs font-medium">View My Customers</span>
        </Card>
      </Link>
    </div>
  );
}
