"use client";

import {
  LayoutDashboard,
  Users,
  Ticket,
  Banknote,
  Gift,
  Image as ImageIcon,
  Handshake,
  TicketPercent,
  LifeBuoy,
  Flag,
  BarChart3,
} from "lucide-react";
import { PortalShell, type PortalNavSection } from "@/components/portal/portal-shell";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const sections: PortalNavSection[] = [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
        { href: "/admin/users", label: "User Management", icon: Users },
        { href: "/admin/agents", label: "Agents", icon: Handshake },
        { href: "/admin/bets", label: "Bets", icon: Ticket },
        { href: "/admin/settlement", label: "Settlement", icon: Flag },
        { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
        { href: "/admin/vouchers", label: "Vouchers", icon: TicketPercent },
        { href: "/admin/promotions", label: "Promotions", icon: Gift },
        { href: "/admin/banners", label: "Banners", icon: ImageIcon },
        { href: "/admin/support", label: "Support", icon: LifeBuoy },
      ],
    },
  ];

  return (
    <PortalShell badge="Admin Dashboard" sections={sections}>
      {children}
    </PortalShell>
  );
}
