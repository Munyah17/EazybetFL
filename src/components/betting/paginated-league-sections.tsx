"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeagueSections } from "@/components/betting/league-section";
import type { FixtureWithOdds } from "@/lib/data/fixture-types";

const INITIAL_GROUPS = 4;
const INCREMENT_GROUPS = 4;

/** Reveals fixtures competition-by-competition instead of dumping the
 * whole list at once, so a short result set doesn't leave the footer
 * awkwardly hugging the header, and a long one doesn't force everything
 * into a single giant render. */
export function PaginatedLeagueSections({ fixtures }: { fixtures: FixtureWithOdds[] }) {
  const groups = useMemo(() => {
    const byCompetition = new Map<string, FixtureWithOdds[]>();
    for (const f of fixtures) {
      const key = f.competition?.id ?? "unknown";
      if (!byCompetition.has(key)) byCompetition.set(key, []);
      byCompetition.get(key)!.push(f);
    }
    return Array.from(byCompetition.values());
  }, [fixtures]);

  const [visibleGroupCount, setVisibleGroupCount] = useState(INITIAL_GROUPS);
  const visibleFixtures = useMemo(
    () => groups.slice(0, visibleGroupCount).flat(),
    [groups, visibleGroupCount]
  );
  const remainingGroups = groups.length - visibleGroupCount;

  return (
    <div className="flex flex-col gap-4">
      <LeagueSections fixtures={visibleFixtures} />
      {remainingGroups > 0 && (
        <Button
          variant="outline"
          className="mx-auto"
          onClick={() => setVisibleGroupCount((c) => c + INCREMENT_GROUPS)}
        >
          Show More <ChevronDown className="size-4" />
        </Button>
      )}
    </div>
  );
}
