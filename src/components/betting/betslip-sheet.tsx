"use client";

import { Ticket } from "lucide-react";
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
        <SheetHeader className="flex-row items-center gap-2 border-b border-border px-3 py-2.5">
          {/* Visually hidden but keeps the sheet accessible to screen readers */}
          <SheetTitle className="sr-only">Betslip</SheetTitle>
          <span className="relative flex shrink-0 items-center justify-center">
            <Ticket className="size-4.5 text-primary" />
            {selections.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {selections.length}
              </span>
            )}
          </span>
          <LoadBetInline />
        </SheetHeader>

        <BetslipContent onPlaced={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
