"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { QrCode, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useBetslip, type BetType, type BetslipSelection } from "@/lib/betslip-store";

type RawSelection = {
  fixture_id: string;
  market_id: string;
  outcome_id: string;
  selection_name: string;
  market_name: string;
  fixture_label: string;
  odds_price: number;
};

export default function LoadBetPage() {
  return (
    <Suspense>
      <LoadBetForm />
    </Suspense>
  );
}

function LoadBetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const loadSelections = useBetslip((s) => s.loadSelections);
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [loading, setLoading] = useState(false);

  async function handleLoad(codeToLoad?: string) {
    const target = (codeToLoad ?? code).trim();
    if (!target) {
      toast.error("Enter your bet code");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_load_booked_bet", { p_bet_code: target });
    setLoading(false);

    if (error) {
      toast.error("Could not load bet", { description: mapError(error.message) });
      return;
    }

    const result = data as { bet_type: BetType; selections: RawSelection[] };
    const mapped: BetslipSelection[] = result.selections.map((s) => ({
      outcomeId: s.outcome_id,
      marketId: s.market_id,
      fixtureId: s.fixture_id,
      selectionName: s.selection_name,
      marketName: s.market_name,
      fixtureLabel: s.fixture_label,
      oddsPrice: s.odds_price,
    }));

    loadSelections(mapped, result.bet_type);
    toast.success("Bet loaded into your betslip");
    router.push("/");
  }

  useEffect(() => {
    // One-time action on mount (RPC call), not a state mirror -- intentional.
    const fromQuery = searchParams.get("code");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromQuery) handleLoad(fromQuery.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col">
      <PageHeader title="Load Saved Bet" backHref="/" />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Bet Code / Voucher</Label>
          <div className="flex gap-2">
            <Input
              id="code"
              placeholder="Enter your bet code (e.g. EZY7A8X3M2)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider"
            />
            <Button disabled={loading} onClick={() => handleLoad()} className="shrink-0">
              {loading ? "Loading…" : "Load"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Card className="items-center gap-2 border-dashed border-border bg-card py-10 text-center">
          <QrCode className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Scan QR Code</p>
        </Card>

        <div className="flex items-start gap-2 rounded-xl bg-card px-3.5 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>You can find your bet code in the &quot;Book Bet&quot; section after saving a bet.</p>
        </div>
      </div>
    </div>
  );
}

function mapError(message: string) {
  if (message.includes("CODE_NOT_FOUND")) return "That code doesn't exist.";
  if (message.includes("CODE_EXPIRED")) return "This code has expired.";
  if (message.includes("CODE_CANCELLED")) return "This code was cancelled.";
  return "Something went wrong. Please try again.";
}
