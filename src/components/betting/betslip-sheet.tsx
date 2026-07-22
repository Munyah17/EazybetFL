"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBetslip } from "@/lib/betslip-store";
import { useMediaQuery, DESKTOP_QUERY } from "@/lib/use-media-query";
import { BetslipContent } from "@/components/betting/betslip-content";
import { LoadBetInline } from "@/components/betting/load-bet-inline";

/** Mobile-only bottom sheet. On desktop the betslip lives in the always-
 * visible BetslipPanel instead, so this stays force-closed there even if
 * `isOpen` is true (e.g. set by tapping odds while on a desktop viewport
 * that later narrows). */
export function BetslipSheet() {
  const { selections, isOpen, setOpen } = useBetslip();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  return (
    <Sheet open={isOpen && !isDesktop} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[88vh] flex-col rounded-t-2xl border-border bg-background p-0"
      >
        <SheetHeader className="flex-row items-center gap-2 border-b border-border px-4 py-3">
          <SheetTitle className="flex shrink-0 items-center gap-1.5 text-base">
            Betslip
            {selections.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {selections.length}
              </span>
            )}
          </SheetTitle>
          <LoadBetInline />
        </SheetHeader>

        <BetslipContent onPlaced={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
