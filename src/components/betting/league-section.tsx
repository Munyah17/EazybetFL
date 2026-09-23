import { Card } from "@/components/ui/card";
import { FixtureRow } from "@/components/betting/fixture-row";
import type { FixtureWithOdds, QuickMarketKey } from "@/lib/data/fixture-types";

type BucketKey = "live" | "today" | "tomorrow" | "later";

const BUCKET_ORDER: { key: BucketKey; title: string }[] = [
  { key: "live", title: "Live Now" },
  { key: "today", title: "Today" },
  { key: "tomorrow", title: "Tomorrow" },
  { key: "later", title: "Upcoming" },
];

function bucketFor(fixture: FixtureWithOdds, today: string, tomorrow: string): BucketKey {
  if (fixture.status === "live") return "live";
  const day = new Date(fixture.commence_time).toDateString();
  if (day === today) return "today";
  if (day === tomorrow) return "tomorrow";
  return "later";
}

function LeagueGroups({
  fixtures,
  marketKey,
}: {
  fixtures: FixtureWithOdds[];
  marketKey: QuickMarketKey;
}) {
  const byCompetition = new Map<string, { title: string; fixtures: FixtureWithOdds[] }>();

  for (const f of fixtures) {
    const key = f.competition?.id ?? "unknown";
    if (!byCompetition.has(key)) {
      byCompetition.set(key, { title: f.competition?.title ?? "Other", fixtures: [] });
    }
    byCompetition.get(key)!.fixtures.push(f);
  }

  return (
    <>
      {Array.from(byCompetition.entries()).map(([id, group]) => (
        <div key={id}>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
          </div>
          <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
            {group.fixtures.map((f) => (
              <FixtureRow key={f.id} fixture={f} marketKey={marketKey} />
            ))}
          </Card>
        </div>
      ))}
    </>
  );
}

/**
 * Groups fixtures into league sections, but buckets by kickoff window first
 * (Live -> Today -> Tomorrow -> Later). Without the bucketing, a league whose
 * next match is soon drags ALL of its fixtures -- including ones a week out --
 * above other leagues' imminent games, which is how far-future fixtures ended
 * up rendering on top of near/live ones.
 */
export function LeagueSections({
  fixtures,
  marketKey = "h2h",
}: {
  fixtures: FixtureWithOdds[];
  marketKey?: QuickMarketKey;
}) {
  if (fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No fixtures available right now. Check back soon.
      </div>
    );
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = now.toDateString();
  const tomorrowStr = tomorrow.toDateString();

  const buckets = new Map<BucketKey, FixtureWithOdds[]>();
  for (const f of fixtures) {
    const key = bucketFor(f, todayStr, tomorrowStr);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(f);
  }

  const nonEmpty = BUCKET_ORDER.filter((b) => buckets.has(b.key));

  return (
    <div className="flex flex-col gap-4">
      {nonEmpty.map((bucket) => (
        <section key={bucket.key} className="flex flex-col gap-4">
          {nonEmpty.length > 1 && (
            <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {bucket.title}
            </h2>
          )}
          <LeagueGroups fixtures={buckets.get(bucket.key)!} marketKey={marketKey} />
        </section>
      ))}
    </div>
  );
}
