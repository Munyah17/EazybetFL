import Link from "next/link";
import {
  ChevronRight,
  Ticket,
  History,
  Wallet,
  UserCog,
  ShieldCheck,
  Gift,
  Bell,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoney, initials } from "@/lib/format";
import { LogoutButton } from "@/components/account/logout-button";

export default async function AccountPage() {
  const { supabase, user, profile } = await requireUser();
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();

  const links = [
    { href: "/bets", label: "My Bets", icon: Ticket },
    { href: "/wallet", label: "Transaction History", icon: History },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/account/personal", label: "Personal Information", icon: UserCog },
    { href: "/account/security", label: "Security", icon: ShieldCheck },
    { href: "/account/referral", label: "Refer & Earn", icon: Gift },
    { href: "/account/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title="My Account" backHref="/" />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-14">
            <AvatarFallback className="bg-secondary text-base font-bold text-foreground">
              {initials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-base font-semibold">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile.phone ?? profile.email}</p>
          </div>
        </div>

        <Card className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">Wallet Balance</p>
            <p className="text-2xl font-extrabold text-primary">{formatMoney(wallet?.balance ?? 0)}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/wallet/deposit">Deposit</Link>
          </Button>
        </Card>

        <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 hover:bg-accent"
            >
              <l.icon className="size-4.5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{l.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </Card>

        <LogoutButton />
      </div>
    </div>
  );
}
