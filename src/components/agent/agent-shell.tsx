"use client";

import { LayoutDashboard, Users } from "lucide-react";
import { PortalShell, type PortalNavSection } from "@/components/portal/portal-shell";

const sections: PortalNavSection[] = [
  {
    items: [
      { href: "/agent", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/agent/customers", label: "Customers", icon: Users },
    ],
  },
];

export function AgentShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell badge="Agent Dashboard" sections={sections}>
      {children}
    </PortalShell>
  );
}
