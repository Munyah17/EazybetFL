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
  CircleDollarSign,
  CreditCard,
} from "lucide-react";
import { PortalShell, type PortalNavSection } from "@/components/portal/portal-shell";

// Super admin and admin are separate roles with separate portals -- nothing
// here links into /admin/*. Operational items use super-admin-owned mirrors
// of the same tools, so a super admin never touches the admin portal.
const sections: PortalNavSection[] = [
  {
    items: [{ href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Operations",
    items: [
      { href: "/super-admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/super-admin/users", label: "User Management", icon: UserCog },
      { href: "/super-admin/agents", label: "Agents", icon: Handshake },
      { href: "/super-admin/bets", label: "Bets", icon: Ticket },
      { href: "/super-admin/deposits", label: "Deposits", icon: CircleDollarSign },
      { href: "/super-admin/withdrawals", label: "Withdrawals", icon: Banknote },
      { href: "/super-admin/deposit-verifications", label: "Deposit Checks", icon: BadgeCheck },
      { href: "/super-admin/vouchers", label: "Vouchers", icon: TicketPercent },
      { href: "/super-admin/promotions", label: "Promotions", icon: Gift },
      { href: "/super-admin/banners", label: "Banners", icon: ImageIcon },
      { href: "/super-admin/support", label: "Support", icon: LifeBuoy },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/super-admin/staff", label: "Staff Management", icon: Users },
      { href: "/super-admin/escrow", label: "Escrow", icon: Vault },
      { href: "/super-admin/payment-methods", label: "Payment Methods", icon: CreditCard },
      { href: "/super-admin/system", label: "System Status", icon: Activity },
      { href: "/super-admin/logs", label: "Logs", icon: FileWarning },
      { href: "/super-admin/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell badge="Super Admin" sections={sections}>
      {children}
    </PortalShell>
  );
}
