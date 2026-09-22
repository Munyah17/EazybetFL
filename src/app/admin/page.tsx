import Link from "next/link";
import { Users, Ticket, TrendingUp, Banknote, Gift, Image as ImageIcon, BarChart3, UserPlus, Wallet, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailySeries, statusBreakdown } from "@/lib/portal-analytics";
import { AreaChartCard, BarChartCard, DoughnutChartCard } from "@/components/portal/portal-charts";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setDate(monthStart.getDate() - 29);
  const monthStartIso = monthStart.toISOString();

  const [
    { count: totalUsers },
    { count: totalBets },
    { data: stakeRows },
    { data: recentUsers },
    { data: recentDeposits },
    { data: bigWins },
    { data: deposits30 },
    { data: withdrawals30 },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("bets").select("id", { count: "exact", head: true }),
    supabase.from("bets").select("stake, status, placed_at"),
    supabase.from("profiles").select("full_name, created_at").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("deposits")
      .select("amount, created_at, user_id, profiles(full_name)")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bets")
      .select("potential_payout, settled_at, user_id, profiles(full_name)")
      .eq("status", "won")
      .order("settled_at", { ascending: false })
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
  ]);

  const turnover = (stakeRows ?? []).reduce((sum, b) => sum + Number(b.stake), 0);

  type Activity = { icon: React.ComponentType<{ className?: string }>; label: string; value: string; at: string };
  const activity: Activity[] = [
    ...(recentUsers ?? []).map((u) => ({
      icon: UserPlus,
      label: "New User",
      value: u.full_name,
      at: u.created_at,
    })),
    ...(recentDeposits ?? []).map((d) => ({
      icon: Wallet,
      label: "New Deposit",
      value: formatMoney(Number(d.amount)),
      at: d.created_at,
    })),
    ...(bigWins ?? []).map((w) => ({
      icon: Trophy,
      label: "Big Win",
      value: formatMoney(Number(w.potential_payout)),
      at: w.settled_at ?? "",
    })),
  ]
    .filter((a) => a.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const stats = [
    { label: "Total Users", value: String(totalUsers ?? 0), icon: Users, chip: "bg-chart-1/10 text-chart-1" },
    { label: "Total Bets", value: String(totalBets ?? 0), icon: Ticket, chip: "bg-chart-3/10 text-chart-3" },
    { label: "Total Turnover", value: formatMoney(turnover), icon: TrendingUp, chip: "bg-chart-2/10 text-chart-2" },
  ];

  const quickActions = [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/bets", label: "Bets", icon: Ticket },
    { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
    { href: "/admin/promotions", label: "Promotions", icon: Gift },
    { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  ];

  // Dashboard-3 (marketing analytics) chart data -- all derived from the
  // rows above, no extra queries.
  const turnoverSeries = dailySeries(stakeRows ?? [], (b) => b.placed_at, (b) => Number(b.stake));
  const betStatus = statusBreakdown(stakeRows ?? [], (b) => b.status);
  const depositSeries = dailySeries(deposits30 ?? [], (d) => d.created_at, (d) => Number(d.amount));
  const withdrawalSeries = dailySeries(withdrawals30 ?? [], (w) => w.requested_at, (w) => Number(w.amount));
  const cashflow = depositSeries.map((d, i) => ({
    label: d.label,
    deposits: d.value,
    withdrawals: withdrawalSeries[i]?.value ?? 0,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Users, bets, and turnover at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <DoughnutChartCard title="Bet Status" subtitle="All bets by outcome." data={betStatus} />
      </div>

      <BarChartCard
        title="Cashflow"
        subtitle="Completed deposits vs withdrawals, last 30 days."
        data={cashflow}
        series={[
          { key: "deposits", label: "Deposits", color: "var(--chart-1)" },
          { key: "withdrawals", label: "Withdrawals", color: "var(--chart-4)" },
        ]}
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href}>
              <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
                <a.icon className="size-5 text-primary" />
                <span className="text-xs font-medium">{a.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <BarChart3 className="size-4" /> Recent Activity
        </h2>
        <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <a.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.value}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(a.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
