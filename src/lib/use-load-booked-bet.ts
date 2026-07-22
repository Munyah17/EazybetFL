"use client";

import { useState } from "react";
import { toast } from "sonner";
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

function mapError(message: string) {
  if (message.includes("CODE_NOT_FOUND")) return "That code doesn't exist.";
  if (message.includes("CODE_EXPIRED")) return "This code has expired.";
  if (message.includes("CODE_CANCELLED")) return "This code was cancelled.";
  return "Something went wrong. Please try again.";
}

/** Shared "load a booked bet by code" action -- used by the dedicated
 * /load-bet page and the inline field on the betslip itself. */
export function useLoadBookedBet() {
  const supabase = createClient();
  const loadSelections = useBetslip((s) => s.loadSelections);
  const [loading, setLoading] = useState(false);

  async function load(code: string): Promise<boolean> {
    const target = code.trim();
    if (!target) {
      toast.error("Enter your bet code");
      return false;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_load_booked_bet", { p_bet_code: target });
    setLoading(false);

    if (error) {
      toast.error("Could not load bet", { description: mapError(error.message) });
      return false;
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
    return true;
  }

  return { load, loading };
}
