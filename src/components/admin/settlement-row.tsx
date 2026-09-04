"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { logAudit } from "@/lib/audit-log";

type Fixture = {
  fixture_id: string;
  label: string;
  competition: string | null;
  commence_time: string;
  status: string;
  pending_selections: number;
  affected_bets: number;
};

export function SettlementRow({ fixture }: { fixture: Fixture }) {
  const supabase = createClient();
  const router = useRouter();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [busy, setBusy] = useState(false);

  async function settle() {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      toast.error("Enter both final scores (whole numbers)");
      return;
    }
    if (!confirm(`Settle "${fixture.label}" as ${h}–${a}? This pays out fully-resolved bets and cannot be undone here.`)) {
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("fn_admin_settle_fixture", {
      p_fixture_id: fixture.fixture_id,
      p_home_score: h,
      p_away_score: a,
    });
    setBusy(false);
    if (error) {
      toast.error("Settlement failed", { description: friendlyError(error) });
      return;
    }
    const r = data as {
      selections_settled: number;
      selections_skipped: number;
      bets_settled: number;
    };
    toast.success(
      `Settled ${r.selections_settled} selection(s), ${r.bets_settled} bet(s)` +
        (r.selections_skipped ? ` · ${r.selections_skipped} left for per-bet review` : "")
    );
    logAudit("fixture_settled_manually", "fixture", fixture.fixture_id, undefined, { home: h, away: a, ...r });
    router.refresh();
  }

  return (
    <Card className="flex-col gap-3 border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{fixture.label}</p>
          <p className="text-xs text-muted-foreground">
            {fixture.competition ?? "—"} ·{" "}
            {new Date(fixture.commence_time).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {fixture.status}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{fixture.affected_bets} open bet(s)</p>
          <p>{fixture.pending_selections} pending pick(s)</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Home"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-20 text-center"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Away"
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-20 text-center"
        />
        <div className="flex-1" />
        <Button size="sm" disabled={busy} onClick={settle}>
          {busy ? "Settling…" : "Settle fixture"}
        </Button>
      </div>
    </Card>
  );
}
