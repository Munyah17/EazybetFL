"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportIcon } from "@/components/betting/sport-icon";
import { displayGroupName } from "@/lib/sport-display";
import type { SportGroupWithCount } from "@/lib/data/sport-groups";

export function DesktopSidebar({ groups }: { groups: SportGroupWithCount[] }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-[57px] hidden h-[calc(100svh-57px)] w-64 shrink-0 flex-col overflow-y-auto border-r border-border py-3 lg:flex">
      <nav className="flex flex-col gap-0.5 px-2">
        <SidebarLink href="/sports" active={pathname === "/sports"} icon={Trophy} label="All Sports" />
        <SidebarLink href="/live" active={pathname === "/live"} icon={Radio} label="Live Now" />
      </nav>

      <div className="mt-3 border-t border-border pt-3">
        <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sports
        </p>
        <nav className="flex flex-col gap-0.5 px-2">
          {groups.map((g) => {
            const href = `/sports/${g.key}`;
            const active = pathname === href;
            return (
              <Link
                key={g.id}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium",
                  active ? "bg-primary/10 text-primary" : "text-foreground/85 hover:bg-accent"
                )}
              >
                <SportIcon name={g.icon} className="size-4 shrink-0" />
                <span className="flex-1 truncate">{displayGroupName(g.name)}</span>
                <span className="text-xs text-muted-foreground">{g.fixtureCount}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 text-sm font-semibold",
        active ? "bg-primary/10 text-primary" : "text-foreground/90 hover:bg-accent"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}
