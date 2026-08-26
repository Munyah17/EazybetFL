import { createClient } from "@/lib/supabase/server";
import { checkKeysStatus, type OddsApiKeyStatus } from "@/lib/odds-api/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<OddsApiKeyStatus["status"], string> = {
  ok: "OK",
  low: "Low",
  exhausted: "Exhausted",
  error: "Error",
  not_configured: "Not Configured",
};

const STATUS_VARIANT: Record<OddsApiKeyStatus["status"], "default" | "secondary" | "destructive"> = {
  ok: "default",
  low: "secondary",
  exhausted: "destructive",
  error: "destructive",
  not_configured: "secondary",
};

export default async function SystemStatusPage() {
  const supabase = await createClient();
  const [keys, { data: latestFixture }, { count: fixtureCount }] = await Promise.all([
    checkKeysStatus(),
    supabase.from("fixtures").select("last_synced_at").order("last_synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("fixtures").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">System Status</h1>
        <p className="text-sm text-muted-foreground">
          Live health of the odds data pipeline: key quota, last sync, and fixture volume.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Fixtures Tracked</p>
          <p className="text-xl font-bold">{fixtureCount ?? 0}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Last Synced</p>
          <p className="text-sm font-bold">
            {latestFixture?.last_synced_at
              ? new Date(latestFixture.last_synced_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">The-Odds-API Keys</h2>
        <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
          {keys.map((k) => (
            <div key={k.envVar} className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{k.envVar}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {k.masked}
                  {k.error ? ` — ${k.error}` : ""}
                </p>
              </div>
              {k.configured && k.remaining !== null && (
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">{k.remaining} left</p>
                  <p>{k.used} used</p>
                </div>
              )}
              <Badge variant={STATUS_VARIANT[k.status]} className="shrink-0">
                {STATUS_LABEL[k.status]}
              </Badge>
            </div>
          ))}
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Scheduled syncs run daily at 03:00 (catalog: sports + odds) and 04:00 (scores +
        settlement) UTC. Quota resets on The-Odds-API&apos;s own billing cycle, not necessarily the
        calendar month — check the-odds-api.com&apos;s dashboard for exact reset dates.
      </p>
    </div>
  );
}
