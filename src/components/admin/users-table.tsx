"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { friendlyError } from "@/lib/friendly-error";
import { logAudit } from "@/lib/audit-log";

type UserRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "phone" | "account_number" | "role" | "status" | "created_at"
>;

export type AdminUser = UserRow & {
  balance: number | null;
  principal_balance: number | null;
  bonus_balance: number | null;
  locked_balance: number | null;
  currency: string;
};

type WalletBucket = "balance" | "principal" | "bonus" | "voucher";

function money(currency: string, amount: number | null) {
  if (amount === null) return "—";
  return `${currency} ${amount.toFixed(2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  suspended: "bg-boost/15 text-boost",
  banned: "bg-destructive/15 text-destructive",
};

export function UsersTable({ users }: { users: AdminUser[] }) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(users);
  const [adjustUser, setAdjustUser] = useState<AdminUser | null>(null);

  function patchWallet(id: string, wallet: Partial<AdminUser>) {
    setRows((prev) => prev.map((u) => (u.id === id ? { ...u, ...wallet } : u)));
    setAdjustUser((prev) => (prev && prev.id === id ? { ...prev, ...wallet } : prev));
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function toggleStatus(user: AdminUser) {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", user.id);
    if (error) {
      toast.error("Could not update status", { description: friendlyError(error) });
      return;
    }
    logAudit("status_change", "profile", user.id, { status: user.status }, { status: nextStatus });
    setRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    toast.success(`User ${nextStatus}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email ?? u.phone}</p>
            </div>
            {/* Total visible funds = principal (deposits/vouchers) +
                balance (winnings) + bonus. Showing only `balance` hides
                deposited money entirely. */}
            <div className="w-24 text-right sm:w-28">
              <p className="text-sm font-medium tabular-nums">
                {money(
                  u.currency,
                  u.balance === null && u.principal_balance === null && u.bonus_balance === null
                    ? null
                    : (u.principal_balance ?? 0) + (u.balance ?? 0) + (u.bonus_balance ?? 0)
                )}
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground tabular-nums">
                {money(u.currency, u.principal_balance)} cash
                {u.bonus_balance !== null && u.bonus_balance > 0
                  ? ` + ${money(u.currency, u.bonus_balance)} bonus`
                  : ""}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setAdjustUser(u)}>
              <Wallet className="size-3.5" />
              Wallet
            </Button>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {u.role.replace("_", " ")}
            </Badge>
            <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[u.status])}>
              {u.status}
            </Badge>
            {(u.role === "user" || u.role === "agent") && (
              <Button size="sm" variant="outline" onClick={() => toggleStatus(u)}>
                {u.status === "active" ? "Suspend" : "Activate"}
              </Button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </Card>

      <WalletAdjustDialog
        user={adjustUser}
        onClose={() => setAdjustUser(null)}
        onPatched={patchWallet}
      />
    </div>
  );
}

function WalletAdjustDialog({
  user,
  onClose,
  onPatched,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onPatched: (id: string, wallet: Partial<AdminUser>) => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [bucket, setBucket] = useState<WalletBucket>("balance");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function adjust() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/super-admin/users/${user!.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "wallet_adjust",
          direction,
          bucket,
          amount: value,
          description: reason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Operation failed");
      onPatched(user!.id, {
        balance: json.wallet.balance,
        principal_balance: json.wallet.principal_balance,
        bonus_balance: json.wallet.bonus_balance,
        locked_balance: json.wallet.locked_balance,
        currency: json.wallet.currency,
      });
      setAmount("");
      setReason("");
      toast.success(
        `${direction === "credit" ? "Credited" : "Debited"} ${user!.currency} ${value.toFixed(2)} (${bucket})`
      );
    } catch (e) {
      toast.error("Adjustment failed", { description: friendlyError(e) });
    }
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle>{user.full_name} — wallet</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Winnings</p>
            <p className="text-sm font-bold tabular-nums">{money(user.currency, user.balance)}</p>
          </Card>
          <Card className="border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Principal</p>
            <p className="text-sm font-bold tabular-nums">
              {money(user.currency, user.principal_balance)}
            </p>
          </Card>
          <Card className="border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Bonus</p>
            <p className="text-sm font-bold tabular-nums">
              {money(user.currency, user.bonus_balance)}
            </p>
          </Card>
          <Card className="border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Locked</p>
            <p className="text-sm font-bold tabular-nums">
              {money(user.currency, user.locked_balance)}
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Manual adjustment</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={direction} onValueChange={(v) => setDirection(v as "credit" | "debit")}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bucket} onValueChange={(v) => setBucket(v as WalletBucket)}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balance">Winnings</SelectItem>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="voucher">Voucher</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Amount"
              className="w-28"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Input
            placeholder="Reason (shown in ledger)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Winnings are withdrawable. Principal &amp; Voucher are cash-backed and bet-only.
            Bonus is house promo money. Voucher credits create a redeemed voucher record.
          </p>
          <div className="flex justify-end">
            <Button size="sm" disabled={busy} onClick={adjust}>
              {busy ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
