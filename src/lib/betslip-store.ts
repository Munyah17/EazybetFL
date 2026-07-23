"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BetType = "single" | "multiple" | "system";

export type BetslipSelection = {
  outcomeId: string;
  marketId: string;
  fixtureId: string;
  selectionName: string;
  marketName: string;
  fixtureLabel: string;
  oddsPrice: number;
  commenceTime?: string;
};

type BetslipState = {
  selections: BetslipSelection[];
  betType: BetType;
  stake: number;
  systemSize: number | null;
  winboost: boolean;
  acceptOddsChanges: boolean;
  isOpen: boolean;
  addSelection: (s: BetslipSelection) => void;
  removeSelection: (outcomeId: string) => void;
  clear: () => void;
  setBetType: (t: BetType) => void;
  setStake: (n: number) => void;
  setSystemSize: (n: number | null) => void;
  setWinboost: (b: boolean) => void;
  setAcceptOddsChanges: (b: boolean) => void;
  setOpen: (b: boolean) => void;
  loadSelections: (s: BetslipSelection[], betType: BetType) => void;
  updateOddsPrices: (updates: Record<string, number>) => void;
};

export const useBetslip = create<BetslipState>()(
  persist(
    (set, get) => ({
      selections: [],
      betType: "single",
      stake: 5,
      systemSize: null,
      winboost: true,
      acceptOddsChanges: true,
      isOpen: false,
      addSelection: (s) => {
        const existing = get().selections;
        // Same-market swap: replacing a pick within a market a user already
        // has a selection in (e.g. changing 1X2 pick) rather than stacking it.
        const withoutSameMarket = existing.filter((x) => x.marketId !== s.marketId);
        const already = existing.find((x) => x.outcomeId === s.outcomeId);
        if (already) {
          set({ selections: existing.filter((x) => x.outcomeId !== s.outcomeId), isOpen: true });
          return;
        }
        const next = [...withoutSameMarket, s];
        set({
          selections: next,
          betType: next.length >= 2 && get().betType === "single" ? "multiple" : get().betType,
          isOpen: true,
        });
      },
      removeSelection: (outcomeId) =>
        set({ selections: get().selections.filter((x) => x.outcomeId !== outcomeId) }),
      clear: () => set({ selections: [], systemSize: null }),
      setBetType: (t) => set({ betType: t }),
      setStake: (n) => set({ stake: n }),
      setSystemSize: (n) => set({ systemSize: n }),
      setWinboost: (b) => set({ winboost: b }),
      setAcceptOddsChanges: (b) => set({ acceptOddsChanges: b }),
      setOpen: (b) => set({ isOpen: b }),
      loadSelections: (s, betType) => set({ selections: s, betType, isOpen: true }),
      updateOddsPrices: (updates) =>
        set({
          selections: get().selections.map((s) =>
            s.outcomeId in updates ? { ...s, oddsPrice: updates[s.outcomeId] } : s
          ),
        }),
    }),
    { name: "eazybet-betslip" }
  )
);

export function computeTotalOdds(selections: BetslipSelection[], winboost: boolean, betType: BetType) {
  const product = selections.reduce((acc, s) => acc * s.oddsPrice, 1);
  if (betType === "multiple" && winboost && selections.length >= 3) {
    return Math.round(product * 1.03 * 1000) / 1000;
  }
  return Math.round(product * 1000) / 1000;
}
