"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import { useBetslip } from "@/lib/betslip-store";
import type { FixtureWithOdds } from "@/lib/data/fixture-types";

export function MarketCard({
  fixture,
  market,
}: {
  fixture: FixtureWithOdds;
  market: FixtureWithOdds["markets"][number];
}) {
  const selections = useBetslip((s) => s.selections);
  const addSelection = useBetslip((s) => s.addSelection);
  const suspended = market.status !== "open";

  const outcomes = [...market.odds_outcomes].sort((a, b) => a.display_order - b.display_order);

  return (
    <Card className="gap-2 border-border/60 bg-card p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{market.market_name}</h3>
        {suspended && <span className="text-[11px] font-medium text-destructive">Suspended</span>}
      </div>
      <div className={cn("grid gap-1.5", outcomes.length <= 3 ? "grid-cols-3" : "grid-cols-2")}>
        {outcomes.map((o) => {
          const active = selections.some((s) => s.outcomeId === o.id);
          return (
            <button
              key={o.id}
              disabled={suspended}
              onClick={() =>
                addSelection({
                  outcomeId: o.id,
                  marketId: market.id,
                  fixtureId: fixture.id,
                  selectionName: o.name,
                  marketName: market.market_name,
                  fixtureLabel: `${fixture.home_team} v ${fixture.away_team}`,
                  oddsPrice: o.price,
                })
              }
              className={cn(
                "odds-btn flex flex-col items-center gap-0.5 py-2 disabled:opacity-40",
                active && "odds-btn-active"
              )}
            >
              <span className="text-[11px] font-normal opacity-80">
                {o.name}
                {o.point !== null ? ` ${o.point}` : ""}
              </span>
              <span className="font-bold">{formatOdds(o.price)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
