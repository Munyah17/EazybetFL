import Link from "next/link";
import { Users, Ticket, TrendingUp, Banknote, Gift, BarChart3, UserPlus, Wallet, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: totalBets },
    { data: stakeRows },
    { data: recentUsers },
    { data: recentDeposits },
    { data: bigWins },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("bets").select("id", { count: "exact", head: true }),
    supabase.from("bets").select("stake"),
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
    { label: "Total Users", value: String(totalUsers ?? 0), icon: Users },
    { label: "Total Bets", value: String(totalBets ?? 0), icon: Ticket },
    { label: "Total Turnover", value: formatMoney(turnover), icon: TrendingUp },
  ];

  const quickActions = [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/bets", label: "Bets", icon: Ticket },
    { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
    { href: "/admin/promotions", label: "Promotions", icon: Gift },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-lg font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="items-center gap-1 border-border/60 bg-card p-4 text-center">
            <s.icon className="size-5 text-primary" />
            <p className="text-lg font-extrabold">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

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
                <a.icon className="size-4 shrink-0 text-primary" />
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
