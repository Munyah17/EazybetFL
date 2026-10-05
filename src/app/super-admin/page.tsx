import Link from "next/link";
import {
  Users,
  UserCheck,
  TrendingUp,
  DollarSign,
  Activity,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  Image as ImageIcon,
  Handshake,
  ScrollText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailySeries, statusBreakdown } from "@/lib/portal-analytics";
import { AreaChartCard, BarChartCard, DoughnutChartCard } from "@/components/portal/portal-charts";

export default async function SuperAdminDashboardPage() {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);
  const monthStartIso = monthStart.toISOString();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { data: allBets },
    { data: pendingWithdrawals },
    { count: activeBetsCount },
    { data: depositsToday },
    { data: withdrawalsToday },
    { data: recentAuditLogs },
    { data: deposits30 },
    { data: withdrawals30 },
    { data: signups30 },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("bets").select("stake, potential_payout, status, placed_at"),
    supabase.from("withdrawals").select("amount").eq("status", "pending"),
    supabase.from("bets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("deposits").select("amount").eq("status", "completed").gte("created_at", todayStart.toISOString()),
    supabase.from("withdrawals").select("amount").eq("status", "completed").gte("requested_at", todayStart.toISOString()),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
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

  const turnover = (allBets ?? []).reduce((sum, b) => sum + Number(b.stake), 0);
  const payouts = (allBets ?? [])
    .filter((b) => b.status === "won")
    .reduce((sum, b) => sum + Number(b.potential_payout), 0);
  const revenue = turnover - payouts;
  const pendingWithdrawalTotal = (pendingWithdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
  const depositsTodayTotal = (depositsToday ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  const withdrawalsTodayTotal = (withdrawalsToday ?? []).reduce((sum, w) => sum + Number(w.amount), 0);

  const topStats = [
    { label: "Total Users", value: String(totalUsers ?? 0), icon: Users, chip: "bg-chart-1/10 text-chart-1" },
    { label: "Active Users", value: String(activeUsers ?? 0), icon: UserCheck, chip: "bg-chart-2/10 text-chart-2" },
    { label: "Total Turnover", value: formatMoney(turnover), icon: TrendingUp, chip: "bg-chart-3/10 text-chart-3" },
    { label: "Total Revenue", value: formatMoney(revenue), icon: DollarSign, chip: "bg-chart-4/10 text-chart-4" },
  ];

  const systemStats = [
    { label: "Active Bets", value: String(activeBetsCount ?? 0), icon: Activity, chip: "bg-chart-1/10 text-chart-1" },
    { label: "Pending Withdrawals", value: formatMoney(pendingWithdrawalTotal), icon: Clock, chip: "bg-chart-4/10 text-chart-4" },
    { label: "Deposits Today", value: formatMoney(depositsTodayTotal), icon: ArrowDownCircle, chip: "bg-chart-2/10 text-chart-2" },
    { label: "Withdrawals Today", value: formatMoney(withdrawalsTodayTotal), icon: ArrowUpCircle, chip: "bg-chart-5/10 text-chart-5" },
  ];

  // Dashboard-3 (marketing analytics) chart data -- derived from the rows
  // above, no extra queries beyond the 30-day windows.
  const turnoverSeries = dailySeries(allBets ?? [], (b) => b.placed_at, (b) => Number(b.stake));
  const betStatus = statusBreakdown(allBets ?? [], (b) => b.status);
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
        <h1 className="text-xl font-bold">Super Admin Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Platform health, revenue, and privileged activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topStats.map((s) => (
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

      <div>
        <h2 className="mb-2 text-sm font-semibold">System Stats</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {systemStats.map((s) => (
            <Card key={s.label} className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-5">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tracking-tight">{s.value}</p>
              </div>
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", s.chip)}>
                <s.icon className="size-5" />
              </span>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AreaChartCard
          title="Turnover"
          subtitle="Daily stakes, last 30 days."
          data={turnoverSeries}
          className="lg:col-span-2"
        />
        <DoughnutChartCard title="Bet Status" subtitle="All bets by outcome." data={betStatus} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Cashflow"
          subtitle="Completed deposits vs withdrawals, last 30 days."
          data={cashflow}
          series={[
            { key: "deposits", label: "Deposits", color: "var(--chart-1)" },
            { key: "withdrawals", label: "Withdrawals", color: "var(--chart-4)" },
          ]}
        />
        <BarChartCard
          title="New Signups"
          subtitle="Registrations per day, last 30 days."
          data={signupSeries}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/super-admin/admins">
          <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
            <Users className="size-5 text-primary" />
            <span className="text-xs font-medium">Manage Admins</span>
          </Card>
        </Link>
        <Link href="/super-admin/agents">
          <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
            <Handshake className="size-5 text-primary" />
            <span className="text-xs font-medium">Manage Agents</span>
          </Card>
        </Link>
        <Link href="/super-admin/withdrawals">
          <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
            <Clock className="size-5 text-primary" />
            <span className="text-xs font-medium">Withdrawal Queue</span>
          </Card>
        </Link>
        <Link href="/super-admin/banners">
          <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
            <ImageIcon className="size-5 text-primary" />
            <span className="text-xs font-medium">Banners</span>
          </Card>
        </Link>
        <Link href="/super-admin/audit-log">
          <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
            <ScrollText className="size-5 text-primary" />
            <span className="text-xs font-medium">Audit Log</span>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <ScrollText className="size-4" /> Recent Privileged Actions
        </h2>
        <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
          {(recentAuditLogs ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No privileged actions logged yet.</p>
          ) : (
            (recentAuditLogs ?? []).map((log) => (
              <div key={log.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">{log.action.replace(/_/g, " ")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {log.profiles?.full_name ?? "Unknown"} · {log.entity_type}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(log.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
