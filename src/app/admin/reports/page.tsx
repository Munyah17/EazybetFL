import {
  TrendingUp,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Ticket,
  UserPlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailySeries, statusBreakdown } from "@/lib/portal-analytics";
import { AreaChartCard, BarChartCard, DoughnutChartCard } from "@/components/portal/portal-charts";

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setDate(monthStart.getDate() - 29);
  const monthStartIso = monthStart.toISOString();

  const [
    { data: bets30 },
    { data: settledWins30 },
    { data: deposits30 },
    { data: withdrawals30 },
    { data: signups30 },
  ] = await Promise.all([
    supabase
      .from("bets")
      .select("stake, potential_payout, status, bet_type, placed_at")
      .gte("placed_at", monthStartIso),
    supabase
      .from("bets")
      .select("potential_payout, settled_at")
      .eq("status", "won")
      .gte("settled_at", monthStartIso),
    supabase
      .from("deposits")
      .select("amount, created_at")
      .eq("status", "completed")
      .gte("created_at", monthStartIso),
    supabase
      .from("withdrawals")
      .select("amount, requested_at")
      .eq("status", "completed")
      .gte("requested_at", monthStartIso),
    supabase.from("profiles").select("created_at").gte("created_at", monthStartIso),
  ]);

  const turnover = (bets30 ?? []).reduce((sum, b) => sum + Number(b.stake), 0);
  const payouts = (settledWins30 ?? []).reduce((sum, b) => sum + Number(b.potential_payout), 0);
  const revenue = turnover - payouts;
  const depositsTotal = (deposits30 ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  const withdrawalsTotal = (withdrawals30 ?? []).reduce((sum, w) => sum + Number(w.amount), 0);

  const stats = [
    { label: "Turnover (30d)", value: formatMoney(turnover), icon: TrendingUp, chip: "bg-chart-1/10 text-chart-1" },
    { label: "Revenue (30d)", value: formatMoney(revenue), icon: DollarSign, chip: "bg-chart-2/10 text-chart-2" },
    { label: "Deposits (30d)", value: formatMoney(depositsTotal), icon: ArrowDownCircle, chip: "bg-chart-3/10 text-chart-3" },
    { label: "Withdrawals (30d)", value: formatMoney(withdrawalsTotal), icon: ArrowUpCircle, chip: "bg-chart-4/10 text-chart-4" },
    { label: "Bets Placed (30d)", value: String((bets30 ?? []).length), icon: Ticket, chip: "bg-chart-5/10 text-chart-5" },
    { label: "New Users (30d)", value: String((signups30 ?? []).length), icon: UserPlus, chip: "bg-chart-1/10 text-chart-1" },
  ];

  const turnoverSeries = dailySeries(bets30 ?? [], (b) => b.placed_at, (b) => Number(b.stake));
  const payoutSeries = dailySeries(settledWins30 ?? [], (b) => b.settled_at, (b) => Number(b.potential_payout));
  const betStatus = statusBreakdown(bets30 ?? [], (b) => b.status);
  const betTypes = statusBreakdown(bets30 ?? [], (b) => b.bet_type);
  const depositSeries = dailySeries(deposits30 ?? [], (d) => d.created_at, (d) => Number(d.amount));
  const withdrawalSeries = dailySeries(withdrawals30 ?? [], (w) => w.requested_at, (w) => Number(w.amount));
  const cashflow = depositSeries.map((d, i) => ({
    label: d.label,
    deposits: d.value,
    withdrawals: withdrawalSeries[i]?.value ?? 0,
  }));
  const signupSeries = dailySeries(signups30 ?? [], (p) => p.created_at, () => 1);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Platform analytics for the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AreaChartCard
          title="Turnover"
          subtitle="Daily stakes, last 30 days."
          data={turnoverSeries}
          className="lg:col-span-2"
        />
        <DoughnutChartCard title="Bet Status" subtitle="Bets placed in the window, by outcome." data={betStatus} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AreaChartCard
          title="Payouts"
          subtitle="Winnings settled per day, last 30 days."
          data={payoutSeries}
        />
        <BarChartCard
          title="New Signups"
          subtitle="Registrations per day, last 30 days."
          data={signupSeries}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BarChartCard
          title="Cashflow"
          subtitle="Completed deposits vs withdrawals, last 30 days."
          data={cashflow}
          series={[
            { key: "deposits", label: "Deposits", color: "var(--chart-1)" },
            { key: "withdrawals", label: "Withdrawals", color: "var(--chart-4)" },
          ]}
          className="lg:col-span-2"
        />
        <DoughnutChartCard title="Bet Types" subtitle="Bets placed in the window, by type." data={betTypes} />
      </div>
    </div>
  );
}
