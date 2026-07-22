"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Info, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBetslip, computeTotalOdds, type BetType } from "@/lib/betslip-store";
import { useSession } from "@/lib/auth/session-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, formatOdds } from "@/lib/format";
import { BookBetDialog } from "@/components/betting/book-bet-dialog";

const STAKE_PRESETS = [1, 2, 5, 10, 20, 50];

export function BetslipSheet() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, wallet, refreshWallet } = useSession();
  const {
    selections,
    betType,
    stake,
    systemSize,
    winboost,
    isOpen,
    setOpen,
    removeSelection,
    setBetType,
    setStake,
    setSystemSize,
    setWinboost,
    clear,
  } = useBetslip();

  const [placing, setPlacing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookedCode, setBookedCode] = useState<string | null>(null);

  const totalOdds = useMemo(
    () => computeTotalOdds(selections, winboost, betType),
    [selections, winboost, betType]
  );
  const baseOdds = useMemo(() => computeTotalOdds(selections, false, betType), [selections, betType]);
  const boosted = betType === "multiple" && winboost && selections.length >= 3;

  // Multiple/System require 2+ legs (enforced by fn_place_bet too) -- with
  // fewer than 2 selections there's only ever a single bet to place,
  // regardless of which tab is active.
  const effectiveBetType: BetType =
    selections.length < 2 ? "single" : betType === "single" ? "multiple" : betType;

  const potentialWin =
    effectiveBetType === "single"
      ? stake * (selections[0]?.oddsPrice ?? 0)
      : effectiveBetType === "multiple"
        ? stake * totalOdds
        : systemSize && selections.length > systemSize
          ? (stake / choose(selections.length, systemSize)) *
            selections.reduce((acc, s) => acc * s.oddsPrice, 1)
          : 0;

  const totalStakeRequired = effectiveBetType === "single" ? stake * selections.length : stake;

  async function handlePlaceBet() {
    if (!profile) {
      toast.error("Sign in to place a bet");
      router.push("/sign-in?next=/");
      return;
    }
    if (selections.length === 0) return;
    if ((wallet?.balance ?? 0) < totalStakeRequired) {
      toast.error("Insufficient balance", { description: "Top up your wallet to place this bet." });
      return;
    }
    if (effectiveBetType === "system" && (!systemSize || systemSize >= selections.length)) {
      toast.error("Choose a valid system size");
      return;
    }

    setPlacing(true);
    const { error } = await supabase.rpc("fn_place_bet", {
      p_bet_type: effectiveBetType,
      p_stake: stake,
      p_selections: selections.map((s) => ({ outcome_id: s.outcomeId })),
      p_winboost: winboost,
      p_system_size: effectiveBetType === "system" ? (systemSize ?? undefined) : undefined,
    });
    setPlacing(false);

    if (error) {
      toast.error("Could not place bet", { description: mapDbError(error.message) });
      return;
    }

    toast.success("Bet placed!", { description: "Good luck — check My Bets for live status." });
    clear();
    setOpen(false);
    await refreshWallet();
    router.push("/bets");
  }

  async function handleBookBet() {
    if (selections.length === 0) return;
    setBooking(true);
    const { data, error } = await supabase.rpc("fn_book_bet", {
      p_bet_type: effectiveBetType,
      p_selections: selections.map((s) => ({ outcome_id: s.outcomeId })),
    });
    setBooking(false);

    if (error) {
      toast.error("Could not book bet", { description: mapDbError(error.message) });
      return;
    }
    const result = data as { bet_code: string };
    setBookedCode(result.bet_code);
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[88vh] rounded-t-2xl border-border bg-background p-0"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              Betslip
              {selections.length > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {selections.length}
                </span>
              )}
            </SheetTitle>
            <Button asChild variant="outline" size="sm" onClick={() => setOpen(false)}>
              <Link href="/load-bet">Load Bet</Link>
            </Button>
          </SheetHeader>

          <div className="flex max-h-[calc(88vh-56px)] flex-col overflow-y-auto pb-24">
            <div className="px-4 pt-3">
              <Tabs value={effectiveBetType} onValueChange={(v) => setBetType(v as BetType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="single" className="flex-1">
                    Single
                  </TabsTrigger>
                  <TabsTrigger value="multiple" className="flex-1" disabled={selections.length < 2}>
                    Multiple
                  </TabsTrigger>
                  <TabsTrigger value="system" className="flex-1" disabled={selections.length < 2}>
                    System
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {selections.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center text-muted-foreground">
                <p className="text-sm">Your betslip is empty.</p>
                <p className="text-xs">Tap on any odds to add a selection.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 px-4 py-3">
                {selections.map((s) => (
                  <div
                    key={s.outcomeId}
                    className="flex items-start justify-between gap-2 rounded-xl bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => removeSelection(s.outcomeId)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove selection"
                        >
                          <X className="size-3.5" />
                        </button>
                        <span className="truncate text-sm font-semibold">{s.selectionName}</span>
                      </div>
                      <p className="pl-5 text-xs text-muted-foreground">{s.marketName}</p>
                      <p className="truncate pl-5 text-xs text-muted-foreground">{s.fixtureLabel}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-primary">
                      {formatOdds(s.oddsPrice)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selections.length > 0 && (
              <div className="flex flex-col gap-3 px-4 pb-4">
                {effectiveBetType === "system" && (
                  <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5">
                    <span className="text-sm font-medium">System size</span>
                    <Select
                      value={systemSize ? String(systemSize) : undefined}
                      onValueChange={(v) => setSystemSize(Number(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: selections.length - 1 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} of {selections.length}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {effectiveBetType === "multiple" && selections.length >= 3 && (
                  <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-boost px-1.5 py-0.5 text-[10px] font-bold text-boost-foreground">
                        WinBoost
                      </span>
                      <span className="text-xs font-semibold text-boost">+3%</span>
                      <Info className="size-3.5 text-muted-foreground" />
                    </div>
                    <Switch checked={winboost} onCheckedChange={setWinboost} />
                  </div>
                )}

                {effectiveBetType !== "single" && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm text-muted-foreground">Total Odds</span>
                    <div className="text-right">
                      <span className="text-sm font-bold">{formatOdds(totalOdds)}</span>
                      {boosted && (
                        <p className="text-[11px] text-boost">Boosted from {formatOdds(baseOdds)}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2.5">
                  <span className="text-sm font-medium">
                    Stake {effectiveBetType === "single" && selections.length > 1 ? "(per selection)" : ""}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-7"
                      onClick={() => setStake(Math.max(1, stake - 1))}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={stake}
                      onChange={(e) => setStake(Number(e.target.value) || 0)}
                      className="w-20 text-center"
                    />
                    <Button variant="secondary" size="icon" className="size-7" onClick={() => setStake(stake + 1)}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STAKE_PRESETS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setStake(v)}
                      className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      ${v}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-muted-foreground">
                    {effectiveBetType === "single" ? "Total Stake" : "Potential Win"}
                  </span>
                  <span className="text-base font-bold text-primary">
                    {effectiveBetType === "single"
                      ? formatMoney(totalStakeRequired)
                      : formatMoney(potentialWin)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {selections.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-border bg-background p-3">
              <Button variant="outline" className="flex-1" disabled={booking} onClick={handleBookBet}>
                {booking ? "Booking…" : "Book Bet"}
              </Button>
              <Button className="flex-[2]" disabled={placing} onClick={handlePlaceBet}>
                {placing ? "Placing…" : `Place Bet · ${formatMoney(totalStakeRequired)}`}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <BookBetDialog
        code={bookedCode}
        onClose={() => {
          setBookedCode(null);
          clear();
          setOpen(false);
        }}
      />
    </>
  );
}

function choose(n: number, k: number) {
  if (k < 0 || k > n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

function mapDbError(message: string) {
  if (message.includes("INSUFFICIENT_FUNDS")) return "Your wallet balance is too low for this stake.";
  if (message.includes("MARKET_SUSPENDED")) return "One of your selections was suspended. Remove it and try again.";
  if (message.includes("FIXTURE_NOT_AVAILABLE")) return "One of your selections is no longer available.";
  if (message.includes("NOT_AUTHENTICATED")) return "Please sign in first.";
  return "Something went wrong. Please try again.";
}
