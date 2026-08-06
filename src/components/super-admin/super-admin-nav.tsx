"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Handshake, ScrollText, Vault } from "lucide-react";
import { cn } from "@/lib/utils";

export function SuperAdminNav() {
  const pathname = usePathname();

  const items = [
    { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/super-admin/admins", label: "Admins", icon: Users },
    { href: "/super-admin/agents", label: "Agents", icon: Handshake },
    { href: "/super-admin/escrow", label: "Escrow", icon: Vault },
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
