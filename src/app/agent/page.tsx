import Link from "next/link";
import { Wallet, Percent, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailySeries } from "@/lib/portal-analytics";
import { AreaChartCard } from "@/components/portal/portal-charts";

export default async function AgentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: wallet }, { data: commissionTx }, { count: customerCount }] =
    await Promise.all([
      supabase.from("profiles").select("commission_rate").eq("id", user!.id).single(),
      supabase.from("wallets").select("balance").eq("user_id", user!.id).single(),
      supabase.from("wallet_transactions").select("amount, created_at").eq("user_id", user!.id).eq("type", "commission"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("assigned_agent_id", user!.id),
    ]);

  const totalCommission = (commissionTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
  const commissionSeries = dailySeries(commissionTx ?? [], (t) => t.created_at, (t) => Number(t.amount));

  const stats = [
    { label: "Float Balance", value: formatMoney(wallet?.balance ?? 0), icon: Wallet, chip: "bg-chart-1/10 text-chart-1" },
    { label: "Commission Rate", value: `${Number(profile?.commission_rate ?? 0)}%`, icon: Percent, chip: "bg-chart-3/10 text-chart-3" },
    { label: "Total Commission Earned", value: formatMoney(totalCommission), icon: TrendingUp, chip: "bg-chart-2/10 text-chart-2" },
    { label: "Customers", value: String(customerCount ?? 0), icon: Users, chip: "bg-chart-4/10 text-chart-4" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Agent Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your float, commission, and customers.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-5">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
            </div>
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", s.chip)}>
              <s.icon className="size-5" />
            </span>
          </Card>
        ))}
      </div>

      <AreaChartCard
        title="Commission"
        subtitle="Commission earned per day, last 30 days."
        data={commissionSeries}
      />

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
