"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Handshake,
  ScrollText,
  Vault,
  Ticket,
  Banknote,
  Gift,
  Image as ImageIcon,
  TicketPercent,
  UserCog,
  LifeBuoy,
  Activity,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SuperAdminNav() {
  const pathname = usePathname();

  // Super admin is the top-most role -- its nav is every admin operational
  // tool plus the governance-only ones (Admins, Escrow, Audit Log), not a
  // separate, smaller set of its own. The operational items route through
  // the same /admin/* pages admin itself uses (no need to fork/duplicate
  // them); only the governance items have their own /super-admin/* pages.
  const items = [
    { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: UserCog },
    { href: "/super-admin/agents", label: "Agents", icon: Handshake },
    { href: "/admin/bets", label: "Bets", icon: Ticket },
    { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
    { href: "/admin/vouchers", label: "Vouchers", icon: TicketPercent },
    { href: "/admin/promotions", label: "Promotions", icon: Gift },
    { href: "/admin/banners", label: "Banners", icon: ImageIcon },
    { href: "/admin/support", label: "Support", icon: LifeBuoy },
    { href: "/super-admin/admins", label: "Admins", icon: Users },
    { href: "/super-admin/escrow", label: "Escrow", icon: Vault },
    { href: "/super-admin/system", label: "System Status", icon: Activity },
    { href: "/super-admin/logs", label: "Logs", icon: FileWarning },
    { href: "/super-admin/audit-log", label: "Audit Log", icon: ScrollText },
  ];

  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
      {items.map((item) => {
        const active = item.href === "/super-admin" ? pathname === "/super-admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
