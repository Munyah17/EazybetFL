"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Info, Minus, Plus, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBetslip, computeTotalOdds, type BetType } from "@/lib/betslip-store";
import { useSession } from "@/lib/auth/session-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, formatOdds, formatKickoff } from "@/lib/format";
import { useLoadBookedBet } from "@/lib/use-load-booked-bet";
import { BookBetDialog } from "@/components/betting/book-bet-dialog";
import { cn } from "@/lib/utils";

const STAKE_PRESETS = [1, 2, 5, 10, 20, 50];
const MIN_STAKE = 1;

export function BetslipContent({ onPlaced }: { onPlaced?: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const { profile, wallet, openBetsCount, refreshWallet } = useSession();
  const {
    selections,
    betType,
    stake,
    systemSize,
    winboost,
    acceptOddsChanges,
    removeSelection,
    setBetType,
    setStake,
    setSystemSize,
    setWinboost,
    setAcceptOddsChanges,
    clear,
    updateOddsPrices,
  } = useBetslip();
  const { load: loadByCode, loading: loadingCode } = useLoadBookedBet();

  const [placing, setPlacing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookedCode, setBookedCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [boostBannerDismissed, setBoostBannerDismissed] = useState(false);

  const totalOdds = useMemo(
    () => computeTotalOdds(selections, winboost, betType),
    [selections, winboost, betType]
  );
  const baseOdds = useMemo(() => computeTotalOdds(selections, false, betType), [selections, betType]);

  // Multiple/System require 2+ legs (enforced by fn_place_bet too) -- with
  // fewer than 2 selections there's only ever a single bet to place. Once
  // there are 2+, the user's explicit tab choice wins -- "Single" with
  // multiple selections is a valid, real mode (N independent bets), not
  // something to silently override. The one-time nudge from Single to
  // Multiple on the 1->2 selection transition lives in the store's
  // addSelection, not here.
  const effectiveBetType: BetType = selections.length < 2 ? "single" : betType;
  const boosted = effectiveBetType === "multiple" && winboost && selections.length >= 3;

  const potentialWin =
    effectiveBetType === "single"
      ? stake * (selections[0]?.oddsPrice ?? 0)
      : effectiveBetType === "multiple"
        ? stake * totalOdds
        : systemSize && selections.length > systemSize
          ? (stake / choose(selections.length, systemSize)) *
            selections.reduce((acc, s) => acc * s.oddsPrice, 1)
          : 0;
  const baseWin = effectiveBetType === "multiple" ? stake * baseOdds : potentialWin;
  const boostAmount = boosted ? potentialWin - baseWin : 0;

  const totalStakeRequired = effectiveBetType === "single" ? stake * selections.length : stake;

  async function handleLoadCode() {
    const ok = await loadByCode(code);
    if (ok) setCode("");
  }

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

    if (!acceptOddsChanges) {
      const { data: fresh } = await supabase
        .from("odds_outcomes")
        .select("id, price")
        .in(
          "id",
          selections.map((s) => s.outcomeId)
        );
      const changed = (fresh ?? []).filter((o) => {
        const sel = selections.find((s) => s.outcomeId === o.id);
        return sel && Math.abs(sel.oddsPrice - o.price) > 0.001;
      });
      if (changed.length > 0) {
        updateOddsPrices(Object.fromEntries(changed.map((o) => [o.id, o.price])));
        toast.error("Odds have changed", {
          description: `${changed.length} selection${changed.length > 1 ? "s" : ""} updated. Review and place again.`,
        });
        return;
      }
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
    onPlaced?.();
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
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex shrink-0 flex-col gap-1.5 p-3">
          <span className="flex items-center justify-center gap-1.5 bg-primary py-2 text-sm font-bold text-primary-foreground">
            Betslip
            {selections.length > 0 && <span>({selections.length})</span>}
          </span>
          <Link
            href="/bets"
            className="flex items-center justify-center gap-1.5 border border-border bg-secondary py-2 text-sm font-bold text-secondary-foreground hover:bg-accent"
          >
            My Bets {profile && <span>({openBetsCount})</span>}
          </Link>
        </div>

        <div className="px-3">
          <Tabs value={effectiveBetType} onValueChange={(v) => setBetType(v as BetType)}>
            <TabsList variant="line" className="w-full border-b border-border">
              <TabsTrigger value="single" className="flex-1">
                Single
              </TabsTrigger>
              <TabsTrigger
                value="multiple"
                className={cn("flex-1", selections.length >= 2 && "text-foreground/90")}
                disabled={selections.length < 2}
              >
                Multiple
              </TabsTrigger>
              <TabsTrigger
                value="system"
                className={cn("flex-1", selections.length >= 2 && "text-foreground/90")}
                disabled={selections.length < 2}
              >
                System
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {selections.length === 1 && (
            <p className="pt-1.5 text-[11px] text-muted-foreground">
              Add 1 more selection to unlock Multiple &amp; System bets.
            </p>
          )}
        </div>

        {boosted && !boostBannerDismissed && (
          <div className="mx-3 mt-2.5 flex items-start gap-2 bg-boost/15 px-3 py-2.5 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0 text-boost" />
            <p className="flex-1 text-foreground/90">
              <span className="font-bold text-boost">WinBoost active:</span> your odds are boosted +3% for
              this {selections.length}-selection multiple.
            </p>
            <button
              onClick={() => setBoostBannerDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Always available, regardless of whether the betslip already has
         * selections -- previously this only showed in the empty state,
         * so it "disappeared" (and looked broken) the moment you had a
         * pick in progress. */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleLoadCode()}
            placeholder="Booking Code"
            className="font-mono text-xs tracking-wide"
          />
          <Button size="sm" variant="outline" disabled={loadingCode} onClick={handleLoadCode}>
            {loadingCode ? "…" : "Load"}
          </Button>
        </div>

        {selections.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-14 text-center text-muted-foreground">
            <Receipt className="size-9 opacity-40" />
            <p className="text-sm font-medium text-foreground">Your Betslip Is Empty</p>
            <p className="text-xs">Please add some selections to place a bet.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 pt-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={acceptOddsChanges} onCheckedChange={(v) => setAcceptOddsChanges(!!v)} />
                Accept Odds Changes
              </label>
              <button
                onClick={clear}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive"
              >
                Remove All <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2 px-3 py-3">
              {selections.map((s) => (
                <div key={s.outcomeId} className="flex items-start justify-between gap-2 bg-card px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.fixtureLabel}</span>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.marketName} - {s.selectionName}
                    </p>
                    {s.commenceTime && (
                      <p className="text-[11px] text-muted-foreground/80">{formatKickoff(s.commenceTime)}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="bg-secondary px-2 py-0.5 text-sm font-bold text-primary">
                      {formatOdds(s.oddsPrice)}
                    </span>
                    <button
                      onClick={() => removeSelection(s.outcomeId)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove selection"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selections.length > 0 && (
          <div className="flex flex-col gap-3 px-3 pb-4">
            {effectiveBetType === "system" && (
              <div className="flex items-center justify-between bg-card px-3 py-2.5">
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
              <div className="flex items-center justify-between bg-card px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="bg-boost px-1.5 py-0.5 text-[10px] font-bold text-boost-foreground">
                    WinBoost
                  </span>
                  <span className="text-xs font-semibold text-boost">+3%</span>
                </div>
                <Switch checked={winboost} onCheckedChange={setWinboost} />
              </div>
            )}

            <div className="flex items-center justify-between gap-3 bg-card px-3 py-2.5">
              <span className="text-sm font-medium">
                Stake {effectiveBetType === "single" && selections.length > 1 ? "(per selection)" : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-7"
                  onClick={() => setStake(Math.max(MIN_STAKE, stake - 1))}
                >
                  <Minus className="size-3.5" />
                </Button>
                <div className="flex items-center border border-input">
                  <Input
                    type="number"
                    min={MIN_STAKE}
                    step={0.5}
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value) || 0)}
                    className="w-16 border-0 text-center"
                  />
                  <span className="pr-2.5 text-xs font-medium text-muted-foreground">USD</span>
                </div>
                <Button variant="secondary" size="icon" className="size-7" onClick={() => setStake(stake + 1)}>
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
            <p className="-mt-2 text-right text-[11px] text-muted-foreground">Min Stake is {MIN_STAKE}</p>

            <div className="flex flex-wrap gap-1.5">
              {STAKE_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setStake(v)}
                  className="bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  ${v}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              {effectiveBetType !== "single" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Odds</span>
                  <span className="text-sm font-bold">{formatOdds(totalOdds)}</span>
                </div>
              )}
              {boosted && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win Boost (3%)</span>
                  <span className="text-sm font-bold text-boost">+{formatMoney(boostAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {effectiveBetType === "single" ? "Total Stake" : "Max Payout"}
                </span>
                <span className="text-base font-bold text-primary">
                  {effectiveBetType === "single" ? formatMoney(totalStakeRequired) : formatMoney(potentialWin)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {selections.length > 0 && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-background p-3">
          <Button disabled={placing} onClick={handlePlaceBet}>
            {placing
              ? "Placing…"
              : !profile
                ? "Login to Bet"
                : `Place Bet · ${formatMoney(totalStakeRequired)}`}
          </Button>
          <Button variant="outline" disabled={booking} onClick={handleBookBet}>
            {booking ? "Booking…" : "Book Bet"}
          </Button>
        </div>
      )}

      <BookBetDialog
        code={bookedCode}
        onClose={() => {
          setBookedCode(null);
          clear();
          onPlaced?.();
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
