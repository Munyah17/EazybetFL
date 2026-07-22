import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MarketCard } from "@/components/betting/market-card";
import { getFixtureById } from "@/lib/data/fixtures";
import { formatKickoff } from "@/lib/format";

export const revalidate = 15;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixture = await getFixtureById(id);
  if (!fixture) notFound();

  const isLive = fixture.status === "live";
  const markets = [...fixture.markets].sort((a, b) => a.market_key.localeCompare(b.market_key));

  return (
    <div className="flex flex-col">
      <PageHeader title={fixture.competition?.title ?? "Match"} backHref="/sports" />

      <div className="flex flex-col gap-1 border-b border-border/60 px-4 py-4 text-center">
        {isLive ? (
          <span className="mx-auto flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
            LIVE {fixture.minute ? `${fixture.minute}'` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{formatKickoff(fixture.commence_time)}</span>
        )}
        <div className="mt-2 flex items-center justify-center gap-4">
          <span className="text-base font-bold">{fixture.home_team}</span>
          {isLive && (
            <span className="text-lg font-extrabold text-primary">
              {fixture.home_score ?? 0} - {fixture.away_score ?? 0}
            </span>
          )}
          {!isLive && <span className="text-sm text-muted-foreground">v</span>}
          <span className="text-base font-bold">{fixture.away_team}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {markets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No markets available for this match.</p>
        ) : (
          markets.map((m) => <MarketCard key={m.id} fixture={fixture} market={m} />)
        )}
      </div>
    </div>
  );
}
