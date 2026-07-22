import { Card } from "@/components/ui/card";
import { FixtureRow } from "@/components/betting/fixture-row";
import type { FixtureWithOdds } from "@/lib/data/fixture-types";

export function LeagueSections({ fixtures }: { fixtures: FixtureWithOdds[] }) {
  const byCompetition = new Map<string, { title: string; fixtures: FixtureWithOdds[] }>();

  for (const f of fixtures) {
    const key = f.competition?.id ?? "unknown";
    if (!byCompetition.has(key)) {
      byCompetition.set(key, { title: f.competition?.title ?? "Other", fixtures: [] });
    }
    byCompetition.get(key)!.fixtures.push(f);
  }

  if (byCompetition.size === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No fixtures available right now. Check back soon.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byCompetition.entries()).map(([id, group]) => (
        <div key={id}>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-muted-foreground">{group.title}</h3>
          </div>
          <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
            {group.fixtures.map((f) => (
              <FixtureRow key={f.id} fixture={f} />
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
