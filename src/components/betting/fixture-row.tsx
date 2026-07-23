"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatKickoff, formatOdds } from "@/lib/format";
import { useBetslip, type BetslipSelection } from "@/lib/betslip-store";
import { h2hOutcomes, type FixtureWithOdds } from "@/lib/data/fixture-types";

export function FixtureRow({ fixture }: { fixture: FixtureWithOdds }) {
  const odds = h2hOutcomes(fixture);
  const selections = useBetslip((s) => s.selections);
  const addSelection = useBetslip((s) => s.addSelection);
  const isLive = fixture.status === "live";

  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
      <Link href={`/match/${fixture.id}`} className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          {isLive ? (
            <span className="flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
              LIVE {fixture.minute ? `${fixture.minute}'` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">{formatKickoff(fixture.commence_time)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{fixture.home_team}</span>
          {isLive && <span className="shrink-0 text-sm font-bold">{fixture.home_score ?? 0}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{fixture.away_team}</span>
          {isLive && <span className="shrink-0 text-sm font-bold">{fixture.away_score ?? 0}</span>}
        </div>
      </Link>

      {odds && (odds.home || odds.draw || odds.away) && (
        <div className="grid shrink-0 grid-cols-3 gap-1.5">
          <OddsButton
            outcome={odds.home}
            fixture={fixture}
            marketId={odds.marketId}
            marketName="Full Time Result"
            selections={selections}
            onPick={addSelection}
          />
          {odds.draw ? (
            <OddsButton
              outcome={odds.draw}
              fixture={fixture}
              marketId={odds.marketId}
              marketName="Full Time Result"
              selections={selections}
              onPick={addSelection}
            />
          ) : (
            <div />
          )}
          <OddsButton
            outcome={odds.away}
            fixture={fixture}
            marketId={odds.marketId}
            marketName="Full Time Result"
            selections={selections}
            onPick={addSelection}
          />
        </div>
      )}
    </div>
  );
}

function OddsButton({
  outcome,
  fixture,
  marketId,
  marketName,
  selections,
  onPick,
}: {
  outcome?: { id: string; name: string; price: number };
  fixture: FixtureWithOdds;
  marketId: string;
  marketName: string;
  selections: { outcomeId: string }[];
  onPick: (s: BetslipSelection) => void;
}) {
  if (!outcome) return <div />;
  const active = selections.some((s) => s.outcomeId === outcome.id);

  return (
    <button
      onClick={() =>
        onPick({
          outcomeId: outcome.id,
          marketId,
          fixtureId: fixture.id,
          selectionName: outcome.name,
          marketName,
          fixtureLabel: `${fixture.home_team} v ${fixture.away_team}`,
          oddsPrice: outcome.price,
          commenceTime: fixture.commence_time,
        })
      }
      className={cn("odds-btn min-w-14", active && "odds-btn-active")}
    >
      {formatOdds(outcome.price)}
    </button>
  );
}
