"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBetslip } from "@/lib/betslip-store";
import { useMediaQuery, DESKTOP_QUERY } from "@/lib/use-media-query";
import { BetslipContent } from "@/components/betting/betslip-content";

/** Mobile-only bottom sheet. On desktop the betslip lives in the always-
 * visible BetslipPanel instead, so this stays force-closed there even if
 * `isOpen` is true (e.g. set by tapping odds while on a desktop viewport
 * that later narrows). */
export function BetslipSheet() {
  const { isOpen, setOpen } = useBetslip();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  return (
    <Sheet open={isOpen && !isDesktop} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[88vh] flex-col rounded-t-2xl border-border bg-background p-0"
      >
        {/* Visually hidden but keeps the sheet accessible to screen readers -- the
         * visible "Betslip" header lives inside BetslipContent itself. */}
        <SheetHeader className="sr-only">
          <SheetTitle>Betslip</SheetTitle>
        </SheetHeader>

        <BetslipContent onPlaced={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
