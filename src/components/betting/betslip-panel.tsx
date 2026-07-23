"use client";

import { BetslipContent } from "@/components/betting/betslip-content";

/** Persistent desktop betslip -- always visible in the right-hand column,
 * never a drawer/overlay. Mirrors the same zustand store as the mobile
 * BetslipSheet, so a selection made on either surface shows on both. */
export function BetslipPanel() {
  return (
    <aside className="sticky top-[57px] hidden h-[calc(100svh-57px)] w-80 shrink-0 flex-col border-l border-border lg:flex">
      <BetslipContent />
    </aside>
  );
}
