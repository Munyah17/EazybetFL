"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { formatMoney } from "@/lib/format";

const EXCLUSION_OPTIONS = [
  { label: "24 Hours", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "6 Months", days: 182 },
];

export default function ResponsibleGamblingPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [excludedUntil, setExcludedUntil] = useState<string | null>(null);
  const [confirmDays, setConfirmDays] = useState<number | null>(null);
  const [excluding, setExcluding] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("responsible_gambling_settings")
        .select("daily_deposit_limit, self_exclusion_until")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.daily_deposit_limit) setLimit(String(data.daily_deposit_limit));
      if (data?.self_exclusion_until && new Date(data.self_exclusion_until) > new Date()) {
        setExcludedUntil(data.self_exclusion_until);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLimit() {
    setSavingLimit(true);
    const parsed = limit.trim() ? Number(limit) : null;
    // The generated arg type is `number` (Supabase's generator doesn't
    // infer nullability for plain params), but the SQL function genuinely
    // accepts and handles null as "clear the limit".
    const { error } = await supabase.rpc("fn_set_deposit_limit", { p_daily_limit: parsed as number });
    setSavingLimit(false);
    if (error) {
      toast.error("Could not save limit", { description: friendlyError(error) });
      return;
    }
    toast.success(parsed ? `Daily deposit limit set to ${formatMoney(parsed)}` : "Deposit limit removed");
  }

  async function confirmExclude() {
    if (!confirmDays) return;
    setExcluding(true);
    const { error } = await supabase.rpc("fn_self_exclude", { p_duration_days: confirmDays });
    setExcluding(false);
    setConfirmDays(null);
    if (error) {
      toast.error("Could not self-exclude", { description: friendlyError(error) });
      return;
    }
    const until = new Date(Date.now() + confirmDays * 86400000);
    setExcludedUntil(until.toISOString());
    toast.success("You've been self-excluded", { description: `Until ${until.toLocaleDateString()}.` });
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Responsible Gambling" backHref="/account" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Responsible Gambling" backHref="/account" />
      <div className="flex flex-col gap-4 p-4">
        {excludedUntil && (
          <Card className="flex-row items-start gap-3 border-destructive/40 bg-destructive/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">You are self-excluded</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Depositing and placing bets are disabled until{" "}
                {new Date(excludedUntil).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}.
                This can&apos;t be undone early from your account — contact support if you believe this is an error.
              </p>
            </div>
          </Card>
        )}

        <Card className="border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold">Daily Deposit Limit</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cap how much you can deposit per day. Leave blank for no limit.
          </p>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min="1"
                placeholder="No limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="pl-6"
                disabled={!!excludedUntil}
              />
            </div>
            <Button onClick={saveLimit} disabled={savingLimit || !!excludedUntil}>
              {savingLimit ? "Saving…" : "Save"}
            </Button>
          </div>
        </Card>

        {!excludedUntil && (
          <Card className="border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold">Self-Exclusion</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Block yourself from depositing and betting for a set period. This takes effect immediately and
              can&apos;t be reversed early by you once confirmed.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {EXCLUSION_OPTIONS.map((opt) => (
                <Button key={opt.days} variant="outline" onClick={() => setConfirmDays(opt.days)}>
                  {opt.label}
                </Button>
              ))}
            </div>
          </Card>
        )}

        <p className="flex items-start gap-2 rounded-xl bg-card px-3.5 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Betting should be entertainment, not a way to make money. Never bet more than you can afford to lose.
        </p>
      </div>

      <Dialog open={confirmDays !== null} onOpenChange={(open) => !open && setConfirmDays(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Self-Exclusion</DialogTitle>
            <DialogDescription>
              You&apos;re about to block yourself from depositing and betting for{" "}
              {EXCLUSION_OPTIONS.find((o) => o.days === confirmDays)?.label.toLowerCase()}. This takes effect
              immediately and cannot be undone early from your account. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDays(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmExclude} disabled={excluding}>
              {excluding ? "Confirming…" : "Yes, Self-Exclude"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
