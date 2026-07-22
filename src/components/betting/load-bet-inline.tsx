"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLoadBookedBet } from "@/lib/use-load-booked-bet";

/** Bet-code field + Load button for the betslip header -- rendered as
 * two separate flex children (not one bundled unit) so a parent can lay
 * out [title] [field] [button] with the field truly sitting between
 * the two, not pinned to either side. */
export function LoadBetInline() {
  const [code, setCode] = useState("");
  const { load, loading } = useLoadBookedBet();

  async function handleLoad() {
    const ok = await load(code);
    if (ok) setCode("");
  }

  return (
    <>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && handleLoad()}
        placeholder="Bet code"
        className="h-8 min-w-0 flex-1 text-center font-mono text-xs tracking-wide"
      />
      <Button size="sm" variant="outline" className="h-8 shrink-0 px-2.5" disabled={loading} onClick={handleLoad}>
        {loading ? "…" : "Load Bet"}
      </Button>
    </>
  );
}
