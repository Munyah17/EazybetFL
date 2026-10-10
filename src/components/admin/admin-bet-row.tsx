"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney, formatOdds } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { friendlyError } from "@/lib/friendly-error";
import { logAudit } from "@/lib/audit-log";

type SelectionStatus = Database["public"]["Enums"]["selection_status"];

type Bet = {
  id: string;
  bet_type: string;
  stake: number;
  total_odds: number;
  potential_payout: number;
  status: string;
  placed_at: string;
  is_free_bet: boolean;
  profiles: { full_name: string } | null;
  bet_selections: {
    id: string;
    selection_name: string;
    market_name: string;
    fixture_label: string;
    odds_price: number;
    status: SelectionStatus;
  }[];
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-boost/15 text-boost",
  won: "bg-primary/15 text-primary",
  lost: "bg-destructive/15 text-destructive",
  void: "bg-muted text-muted-foreground",
  cashed_out: "bg-primary/15 text-primary",
  partially_cashed_out: "bg-primary/15 text-primary",
};

export function AdminBetRow({ bet }: { bet: Bet }) {
  const supabase = createClient();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [selections, setSelections] = useState(bet.bet_selections);
  const [settling, setSettling] = useState(false);

  const allResolved = selections.every((s) => s.status !== "pending");
  // A lost leg decides single/multiple tickets instantly (and can kill a
  // system ticket) -- fn_settle_bet decides server-side either way.
  const decided = allResolved || selections.some((s) => s.status === "lost");

  async function updateSelection(id: string, status: SelectionStatus) {
    const { error } = await supabase.rpc("fn_settle_selection", { p_selection_id: id, p_status: status });
    if (error) {
      toast.error("Could not update selection", { description: friendlyError(error) });
      return;
    }
    setSelections((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    // Grading a leg 'lost' settles the whole ticket in the same
    // transaction -- refresh so the badge reflects it immediately.
    router.refresh();
  }

  async function settleBet() {
    setSettling(true);
    const { data, error } = await supabase.rpc("fn_settle_bet", { p_bet_id: bet.id });
    setSettling(false);
    if (error) {
      toast.error("Could not settle bet", { description: friendlyError(error) });
      return;
    }
    const result = data as { status: string; payout: number };
    toast.success(`Bet settled: ${result.status}`, { description: formatMoney(result.payout) });
    logAudit("bet_settled", "bet", bet.id, undefined, result);
    router.refresh();
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <Badge className={cn("border-0 text-[10px] font-bold uppercase", STATUS_STYLE[bet.status])}>
              {bet.status.replace("_", " ")}
            </Badge>
            <span className="text-sm font-semibold capitalize">{bet.bet_type}</span>
            {bet.is_free_bet && (
              // House-funded stake (super admin "infinite wallet") -- no wallet
              // was debited; any payout returns to the house reserve.
              <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                House
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{bet.profiles?.full_name}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Stake {formatMoney(bet.stake)}</p>
          <p>Odds {formatOdds(bet.total_odds)}</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3">
          {selections.map((sel) => (
            <div key={sel.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{sel.selection_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {sel.market_name} · {sel.fixture_label}
                </p>
              </div>
              {bet.status === "open" ? (
                <Select value={sel.status} onValueChange={(v) => updateSelection(sel.id, v as SelectionStatus)}>
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[sel.status])}>
                  {sel.status}
                </Badge>
              )}
            </div>
          ))}

          {bet.status === "open" && (
            <Button size="sm" disabled={!decided || settling} onClick={settleBet} className="mt-2 w-full">
              {settling ? "Settling…" : decided ? "Settle Bet" : "Set all selections first"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
