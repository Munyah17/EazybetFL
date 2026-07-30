"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeagueSections } from "@/components/betting/league-section";
import type { FixtureWithOdds, QuickMarketKey } from "@/lib/data/fixture-types";

const INITIAL_COUNT = 10;
const INCREMENT_COUNT = 10;

/** Reveals a fixed number of matches at a time instead of dumping the
 * whole list at once. Capped by match count rather than by whole
 * competition groups -- a single busy league (e.g. 12 La Liga fixtures)
 * would otherwise blow past any reasonable initial length on its own
 * before "Show More" ever had a chance to appear. Cutting a competition's
 * section mid-list is fine -- it just continues after the next reveal. */
export function PaginatedLeagueSections({
  fixtures,
  marketKey = "h2h",
}: {
  fixtures: FixtureWithOdds[];
  marketKey?: QuickMarketKey;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const visibleFixtures = fixtures.slice(0, visibleCount);
  const remaining = fixtures.length - visibleCount;

  return (
    <div className="flex flex-col gap-4">
      <LeagueSections fixtures={visibleFixtures} marketKey={marketKey} />
      {remaining > 0 && (
        <Button
          variant="outline"
          className="mx-auto"
          onClick={() => setVisibleCount((c) => c + INCREMENT_COUNT)}
        >
          Show More <ChevronDown className="size-4" />
        </Button>
      )}
    </div>
  );
}
