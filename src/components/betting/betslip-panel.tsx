"use client";

import { useBetslip } from "@/lib/betslip-store";
import { BetslipContent } from "@/components/betting/betslip-content";
import { LoadBetInline } from "@/components/betting/load-bet-inline";

/** Persistent desktop betslip -- always visible in the right-hand column,
 * never a drawer/overlay. Mirrors the same zustand store as the mobile
 * BetslipSheet, so a selection made on either surface shows on both. */
export function BetslipPanel() {
  const selections = useBetslip((s) => s.selections);

  return (
    <aside className="sticky top-[57px] hidden h-[calc(100svh-57px)] w-80 shrink-0 flex-col border-l border-border lg:flex">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <h2 className="flex shrink-0 items-center gap-1.5 text-base font-semibold">
          Betslip
          {selections.length > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selections.length}
            </span>
          )}
        </h2>
        <LoadBetInline />
      </div>

      <BetslipContent />
    </aside>
  );
}
