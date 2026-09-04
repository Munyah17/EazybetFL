import { createClient } from "@/lib/supabase/server";
import { checkKeysStatus, type OddsApiKeyStatus } from "@/lib/odds-api/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

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

type Reconciliation = {
  ok: boolean;
  checked_at: string;
  house_balance: number | null;
  escrow_balance: number | null;
  anomalies: Record<string, unknown>[];
};

export default async function SystemStatusPage() {
  const supabase = await createClient();
  const [keys, { data: latestFixture }, { count: fixtureCount }, { data: reconcileRaw }] = await Promise.all([
    checkKeysStatus(),
    supabase.from("fixtures").select("last_synced_at").order("last_synced_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("fixtures").select("*", { count: "exact", head: true }),
    supabase.rpc("fn_reconcile_ledger"),
  ]);

  const reconcile = reconcileRaw as Reconciliation | null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrlOk = Boolean(appUrl && appUrl.startsWith("https://"));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">System Status</h1>
        <p className="text-sm text-muted-foreground">
          Live health of the odds data pipeline: key quota, last sync, and fixture volume.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Payments Configuration</h2>
        <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">NEXT_PUBLIC_APP_URL</p>
              <p className="truncate text-xs text-muted-foreground">
                {appUrl ?? "not set — falls back to the request host"} · Paynow return &amp; webhook target
              </p>
            </div>
            <Badge variant={appUrlOk ? "default" : "secondary"} className="shrink-0">
              {appUrlOk ? "Set" : "Auto"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">EcoCash Instant Payment (EIP)</p>
              <p className="truncate text-xs text-muted-foreground">Direct EcoCash rail — separate from Paynow</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {process.env.ECOCASH_EIP_LIVE === "true" ? "Live" : "Disabled"}
            </Badge>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Ledger Reconciliation</h2>
        <Card className="border-border/60 bg-card p-4">
          {!reconcile ? (
            <p className="text-sm text-muted-foreground">Could not run reconciliation.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {reconcile.ok ? "Every cent accounted for" : "Discrepancies found"}
                </p>
                <Badge variant={reconcile.ok ? "default" : "destructive"}>
                  {reconcile.ok ? "Balanced" : `${reconcile.anomalies.length} anomaly(ies)`}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  Escrow (open stakes)
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(Number(reconcile.escrow_balance ?? 0))}
                  </p>
                </div>
                <div>
                  House reserve
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(Number(reconcile.house_balance ?? 0))}
                  </p>
                </div>
              </div>
              {!reconcile.ok && (
                <pre className="mt-3 overflow-x-auto rounded bg-secondary/40 p-2 text-[10px]">
                  {JSON.stringify(reconcile.anomalies, null, 2)}
                </pre>
              )}
            </>
          )}
        </Card>
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
