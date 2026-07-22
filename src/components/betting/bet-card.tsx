"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney, formatOdds } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { BetRow } from "@/lib/data/bets";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  open: { label: "OPEN", className: "bg-boost/15 text-boost" },
  won: { label: "WIN", className: "bg-primary/15 text-primary" },
  lost: { label: "LOST", className: "bg-destructive/15 text-destructive" },
  void: { label: "VOID", className: "bg-muted text-muted-foreground" },
  cashed_out: { label: "CASHED OUT", className: "bg-primary/15 text-primary" },
  partially_cashed_out: { label: "PART CASH OUT", className: "bg-primary/15 text-primary" },
};

export function BetCard({ bet }: { bet: BetRow }) {
  const supabase = createClient();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  const style = STATUS_STYLE[bet.status] ?? STATUS_STYLE.open;
  const displayAmount =
    bet.status === "won"
      ? bet.potential_payout
      : bet.status === "cashed_out" || bet.status === "partially_cashed_out"
        ? bet.cash_out_value
        : bet.status === "lost" || bet.status === "void"
          ? 0
          : bet.potential_payout;

  async function loadPreview() {
    const { data } = await supabase.rpc("fn_cash_out_preview", { p_bet_id: bet.id });
    const result = data as { cash_out_value: number | null; eligible: boolean } | null;
    if (result?.eligible) setPreview(result.cash_out_value);
  }

  async function handleCashOut() {
    setCashingOut(true);
    const { data, error } = await supabase.rpc("fn_cash_out", { p_bet_id: bet.id });
    setCashingOut(false);
    if (error) {
      toast.error("Cash out failed", { description: error.message });
      return;
    }
    const result = data as { cash_out_value: number };
    toast.success(`Cashed out for ${formatMoney(result.cash_out_value)}`);
    router.refresh();
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
      <button
        onClick={() => {
          setExpanded((v) => !v);
          if (!expanded && bet.status === "open" && bet.bet_type !== "single") loadPreview();
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5"
      >
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <Badge className={cn("border-0 text-[10px] font-bold", style.className)}>{style.label}</Badge>
            <span className="text-sm font-semibold capitalize">{bet.bet_type}</span>
            <span className="text-xs text-muted-foreground">
              {bet.bet_selections.length} Selection{bet.bet_selections.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(bet.placed_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{formatMoney(bet.stake)} stake</p>
            <p className={cn("text-sm font-bold", bet.status === "lost" ? "text-destructive" : "text-primary")}>
              {formatMoney(displayAmount ?? 0)}
            </p>
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3">
          {bet.bet_selections.map((sel) => (
            <div key={sel.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{sel.selection_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {sel.market_name} · {sel.fixture_label}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold">{formatOdds(sel.odds_price)}</span>
                <SelectionStatusDot status={sel.status} />
              </div>
            </div>
          ))}

          {bet.status === "open" && bet.bet_type !== "single" && (
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="text-xs text-muted-foreground">
                {preview !== null ? `Cash out now for ${formatMoney(preview)}` : "Calculating cash out…"}
              </span>
              <Button size="sm" disabled={cashingOut || preview === null} onClick={handleCashOut}>
                {cashingOut ? "Processing…" : "Cash Out"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SelectionStatusDot({ status }: { status: string }) {
  const color =
    status === "won"
      ? "bg-primary"
      : status === "lost"
        ? "bg-destructive"
        : status === "void"
          ? "bg-muted-foreground"
          : "bg-boost";
  return <span className={cn("size-2 rounded-full", color)} />;
}
