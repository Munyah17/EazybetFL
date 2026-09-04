import { createClient } from "@/lib/supabase/server";
import { SettlementRow } from "@/components/admin/settlement-row";

export const dynamic = "force-dynamic";

type PendingFixture = {
  fixture_id: string;
  label: string;
  competition: string | null;
  commence_time: string;
  status: string;
  pending_selections: number;
  affected_bets: number;
};

export default async function AdminSettlementPage() {
  const supabase = await createClient();

  // Fixtures that have already kicked off but still carry pending bet
  // selections -- i.e. bets waiting on a result the scores feed hasn't
  // delivered. Ordered by exposure (most pending selections first).
  const { data, error } = await supabase.rpc("fn_pending_settlement_fixtures");
  const fixtures = (error ? [] : ((data as PendingFixture[] | null) ?? [])) as PendingFixture[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Manual Settlement</h1>
        <p className="text-sm text-muted-foreground">
          Fixtures that have started but still have unsettled bets — normally the scores feed clears
          these automatically. Enter the final score to settle every h2h / totals selection on the
          fixture and pay out any fully-resolved bet. Other market types (spreads, BTTS…) are left
          for the per-bet queue.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Could not load: {error.message}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {fixtures.map((f) => (
          <SettlementRow key={f.fixture_id} fixture={f} />
        ))}
        {!fixtures.length && !error && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing waiting — every started fixture with open bets has been settled.
          </p>
        )}
      </div>
    </div>
  );
}
