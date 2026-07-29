"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function AgentNav() {
  const pathname = usePathname();

  const items = [
    { href: "/agent", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agent/customers", label: "Customers", icon: Users },
  ];

  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
      {items.map((item) => {
        const active = item.href === "/agent" ? pathname === "/agent" : pathname.startsWith(item.href);
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
