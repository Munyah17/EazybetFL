"use client";

import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SportIcon } from "@/components/betting/sport-icon";
import { PaginatedLeagueSections } from "@/components/betting/paginated-league-sections";
import { displayGroupName } from "@/lib/sport-display";
import { cn } from "@/lib/utils";
import type { FixtureWithOdds, QuickMarketKey } from "@/lib/data/fixture-types";

type SportGroup = { id: string; key: string; name: string; icon: string | null };
type MatchTab = "live" | "top" | "upcoming";
type DateFilter = "today" | "tomorrow" | "week" | "all";
type SortBy = "time" | "league";

const TAB_LABELS: Record<MatchTab, string> = {
  live: "Live Matches",
  top: "Top Events",
  upcoming: "Upcoming Matches",
};

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function MatchExplorer({
  groups,
  liveFixtures,
  upcomingFixtures,
}: {
  groups: SportGroup[];
  liveFixtures: FixtureWithOdds[];
  upcomingFixtures: FixtureWithOdds[];
}) {
  const [tab, setTab] = useState<MatchTab>(liveFixtures.length ? "live" : "upcoming");
  // Football/soccer is the dominant sport for our audience -- default the
  // filter to it (when we actually carry it) instead of "All Sports".
  const [sport, setSport] = useState<string>(() => (groups.some((g) => g.key === "soccer") ? "soccer" : "all"));
  const [sortBy, setSortBy] = useState<SortBy>("time");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [market, setMarket] = useState<QuickMarketKey>("h2h");

  const topFixtures = useMemo(
    () => [...liveFixtures, ...upcomingFixtures].slice(0, 15),
    [liveFixtures, upcomingFixtures]
  );

  const fixtures = useMemo(() => {
    const base = tab === "live" ? liveFixtures : tab === "top" ? topFixtures : upcomingFixtures;
    let rows = sport === "all" ? base : base.filter((f) => f.competition?.sport_group?.key === sport);

    if (tab !== "live" && dateFilter !== "all") {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekOut = now.getTime() + 7 * 24 * 60 * 60 * 1000;

      rows = rows.filter((f) => {
        const kickoff = new Date(f.commence_time);
        if (dateFilter === "today") return isSameDay(kickoff, now);
        if (dateFilter === "tomorrow") return isSameDay(kickoff, tomorrow);
        return kickoff.getTime() <= weekOut;
      });
    }

    return [...rows].sort((a, b) =>
      sortBy === "time"
        ? new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
        : (a.competition?.title ?? "").localeCompare(b.competition?.title ?? "")
    );
  }, [tab, sport, sortBy, dateFilter, liveFixtures, upcomingFixtures, topFixtures]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as MatchTab)} className="gap-0">
      <div className="border-b border-border px-3 py-2.5 lg:px-5">
        <TabsList className="w-full lg:w-auto">
          <TabsTrigger value="live" className="flex-1 lg:flex-none lg:px-6">
            Live {liveFixtures.length > 0 && `(${liveFixtures.length})`}
          </TabsTrigger>
          <TabsTrigger value="top" className="flex-1 lg:flex-none lg:px-6">
            Top Events
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1 lg:flex-none lg:px-6">
            Upcoming
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="no-scrollbar flex items-center gap-5 overflow-x-auto border-b border-border px-3 py-3 lg:px-5">
        <SportChip
          label="All Sports"
          active={sport === "all"}
          onClick={() => setSport("all")}
        />
        {groups.map((g) => (
          <SportChip
            key={g.id}
            label={displayGroupName(g.name)}
            icon={g.icon}
            active={sport === g.key}
            onClick={() => setSport(g.key)}
          />
        ))}
      </div>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 py-2.5 lg:px-5">
        <span className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2 text-primary">
          <Zap className="size-4" />
        </span>
        <FilterSelect
          value={sortBy}
          onChange={(v) => setSortBy(v as SortBy)}
          options={[
            { value: "time", label: "By Time" },
            { value: "league", label: "By League" },
          ]}
        />
        {tab !== "live" && (
          <FilterSelect
            value={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
            options={[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "week", label: "This Week" },
              { value: "all", label: "All Dates" },
            ]}
          />
        )}
        <FilterSelect
          value={market}
          onChange={(v) => setMarket(v as QuickMarketKey)}
          options={[
            { value: "h2h", label: "1X2" },
            { value: "totals", label: "Over/Under" },
          ]}
        />
      </div>

      <div className="bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground lg:px-5">
        {TAB_LABELS[tab]}
      </div>

      <div className="px-3 pt-3 lg:px-5">
        <PaginatedLeagueSections fixtures={fixtures} marketKey={market} />
      </div>
    </Tabs>
  );
}

function SportChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 flex-col items-center gap-1 text-[11px] font-medium",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon !== undefined ? (
        <SportIcon name={icon} className="size-5" />
      ) : (
        <span className="flex size-5 items-center justify-center text-sm">&#9733;</span>
      )}
      <span className={cn("whitespace-nowrap", active && "font-bold")}>{label}</span>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto shrink-0 gap-1.5 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
