import Link from "next/link";
import { Users, UserCheck, TrendingUp, DollarSign, Activity, Clock, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export default async function SuperAdminDashboardPage() {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: totalUsers },
    { count: activeUsers },
    { data: allBets },
    { data: pendingWithdrawals },
    { count: activeBetsCount },
    { data: depositsToday },
    { data: withdrawalsToday },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("bets").select("stake, potential_payout, status"),
    supabase.from("withdrawals").select("amount").eq("status", "pending"),
    supabase.from("bets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("deposits").select("amount").eq("status", "completed").gte("created_at", todayStart.toISOString()),
    supabase.from("withdrawals").select("amount").eq("status", "completed").gte("requested_at", todayStart.toISOString()),
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
    { label: "Total Users", value: String(totalUsers ?? 0), icon: Users },
    { label: "Active Users", value: String(activeUsers ?? 0), icon: UserCheck },
    { label: "Total Turnover", value: formatMoney(turnover), icon: TrendingUp },
    { label: "Total Revenue", value: formatMoney(revenue), icon: DollarSign },
  ];

  const systemStats = [
    { label: "Active Bets", value: String(activeBetsCount ?? 0), icon: Activity },
    { label: "Pending Withdrawals", value: formatMoney(pendingWithdrawalTotal), icon: Clock },
    { label: "Deposits Today", value: formatMoney(depositsTodayTotal), icon: ArrowDownCircle },
    { label: "Withdrawals Today", value: formatMoney(withdrawalsTodayTotal), icon: ArrowUpCircle },
  ];

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-base font-bold">Super Admin Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm font-medium text-primary">
            Admin View
          </Link>
          <Link href="/" className="text-sm font-medium text-primary">
            Back to Site
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          {topStats.map((s) => (
            <Card key={s.label} className="gap-1 border-border/60 bg-card p-4">
              <s.icon className="size-5 text-primary" />
              <p className="text-xl font-extrabold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">System Stats</h2>
          <div className="grid grid-cols-2 gap-3">
            {systemStats.map((s) => (
              <Card key={s.label} className="gap-1 border-border/60 bg-card p-4">
                <s.icon className="size-5 text-boost" />
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/super-admin/admins">
            <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
              <Users className="size-5 text-primary" />
              <span className="text-xs font-medium">Manage Admins</span>
            </Card>
          </Link>
          <Link href="/admin/withdrawals">
            <Card className="items-center gap-1.5 border-border/60 bg-card p-4 text-center hover:bg-accent">
              <Clock className="size-5 text-primary" />
              <span className="text-xs font-medium">Withdrawal Queue</span>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
