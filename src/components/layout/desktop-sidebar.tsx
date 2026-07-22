"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Trophy, ChevronDown, ChevronRight, Globe, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportIcon } from "@/components/betting/sport-icon";
import { displayGroupName } from "@/lib/sport-display";
import type { SportGroupNode, CountryNode } from "@/lib/data/sidebar-tree";

function filterTree(groups: SportGroupNode[], query: string): SportGroupNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  return groups
    .map((g) => {
      const groupMatches = displayGroupName(g.name).toLowerCase().includes(q);
      const countries: CountryNode[] = g.countries
        .map((c) => {
          const countryMatches = c.country.toLowerCase().includes(q);
          const competitions = groupMatches || countryMatches
            ? c.competitions
            : c.competitions.filter((comp) => comp.title.toLowerCase().includes(q));
          return { ...c, competitions };
        })
        .filter((c) => c.competitions.length > 0);
      return { ...g, countries };
    })
    .filter((g) => g.countries.length > 0);
}

export function DesktopSidebar({ groups }: { groups: SportGroupNode[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [expandedSports, setExpandedSports] = useState<Set<string>>(
    () => new Set(groups[0] ? [groups[0].key] : [])
  );
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  const searching = query.trim().length > 0;
  const visibleGroups = useMemo(() => filterTree(groups, query), [groups, query]);

  function toggleSport(key: string) {
    setExpandedSports((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCountry(compositeKey: string) {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) next.delete(compositeKey);
      else next.add(compositeKey);
      return next;
    });
  }

  return (
    <aside className="sticky top-[57px] hidden h-[calc(100svh-57px)] w-64 shrink-0 flex-col overflow-y-auto border-r border-border py-3 lg:flex">
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        <SidebarLink href="/sports" active={pathname === "/sports"} icon={Trophy} label="All Sports" />
        <SidebarLink href="/live" active={pathname === "/live"} icon={Radio} label="Live Now" />
      </nav>

      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search competitions…"
            className="w-full bg-secondary py-2 pl-8 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searching && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-2">
        {visibleGroups.length === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground">No competitions match &ldquo;{query}&rdquo;.</p>
        )}
        {visibleGroups.map((g) => {
          const isOpen = searching || expandedSports.has(g.key);
          return (
            <div key={g.id}>
              <button
                onClick={() => toggleSport(g.key)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-accent"
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <SportIcon name={g.icon} className="size-4 shrink-0 text-primary" />
                <span className="flex-1 truncate">{displayGroupName(g.name)}</span>
                <span className="text-xs text-muted-foreground">{g.fixtureCount}</span>
              </button>

              {isOpen && (
                <div className="pb-1">
                  {g.countries.map((c) => {
                    const compositeKey = `${g.key}:${c.country}`;
                    const countryOpen = searching || expandedCountries.has(compositeKey);
                    return (
                      <div key={compositeKey}>
                        <button
                          onClick={() => toggleCountry(compositeKey)}
                          className="flex w-full items-center gap-2 py-1.5 pl-8 pr-3 text-left text-xs font-medium text-foreground/85 hover:bg-accent"
                        >
                          {countryOpen ? (
                            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                          )}
                          <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{c.country}</span>
                          <span className="text-muted-foreground">{c.fixtureCount}</span>
                        </button>

                        {countryOpen && (
                          <div className="pb-1">
                            {c.competitions.map((comp) => {
                              const href = `/sports/${g.key}/${comp.key}`;
                              const active = pathname === href;
                              return (
                                <Link
                                  key={comp.id}
                                  href={href}
                                  className={cn(
                                    "flex items-center gap-2 py-1.5 pl-14 pr-3 text-xs",
                                    active
                                      ? "bg-primary/10 font-medium text-primary"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                >
                                  <span className="flex-1 truncate">{comp.title}</span>
                                  <span>{comp.fixtureCount}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
