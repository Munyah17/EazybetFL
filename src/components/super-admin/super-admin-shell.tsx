"use client";

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
  BadgeCheck,
  BarChart3,
} from "lucide-react";
import { PortalShell, type PortalNavSection } from "@/components/portal/portal-shell";

// Super admin is the top-most role -- its nav is every admin operational
// tool plus the governance-only ones, grouped into CoolAdmin-style sections.
// Operational items route through the same /admin/* pages admin uses; only
// governance items have their own /super-admin/* pages.
const sections: PortalNavSection[] = [
  {
    items: [{ href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/super-admin/agents", label: "Agents", icon: Handshake },
      { href: "/admin/bets", label: "Bets", icon: Ticket },
      { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
      { href: "/super-admin/deposit-verifications", label: "Deposit Checks", icon: BadgeCheck },
      { href: "/admin/vouchers", label: "Vouchers", icon: TicketPercent },
      { href: "/admin/promotions", label: "Promotions", icon: Gift },
      { href: "/admin/banners", label: "Banners", icon: ImageIcon },
      { href: "/admin/support", label: "Support", icon: LifeBuoy },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/super-admin/admins", label: "Admins", icon: Users },
      { href: "/super-admin/escrow", label: "Escrow", icon: Vault },
      { href: "/super-admin/system", label: "System Status", icon: Activity },
      { href: "/super-admin/logs", label: "Logs", icon: FileWarning },
      { href: "/super-admin/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      badge="Super Admin"
      sections={sections}
      headerLinks={[{ href: "/admin", label: "Admin View" }]}
    >
      {children}
    </PortalShell>
  );
}
