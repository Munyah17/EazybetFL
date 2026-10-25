"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, RefreshCw } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

export type AdminDeposit = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  provider: string;
  status: string;
  phone_number: string | null;
  paynow_reference: string | null;
  client_correlator: string | null;
  provider_transaction_id: string | null;
  created_at: string;
  completed_at: string | null;
  profiles: { full_name: string; email: string | null; account_number: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-boost/15 text-boost",
  processing: "bg-boost/15 text-boost",
  completed: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  reversed: "bg-destructive/15 text-destructive",
};

export function DepositsManager({ deposits }: { deposits: AdminDeposit[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminDeposit | null>(null);
  const [reverseTarget, setReverseTarget] = useState<AdminDeposit | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deposits.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.profiles?.full_name.toLowerCase().includes(q) ||
        d.profiles?.email?.toLowerCase().includes(q) ||
        d.profiles?.account_number.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.paynow_reference?.toLowerCase().includes(q) ||
        d.provider_transaction_id?.toLowerCase().includes(q)
      );
    });
  }, [deposits, query, statusFilter]);

  const totals = useMemo(() => {
    const sum = (s: string) =>
      deposits.filter((d) => d.status === s).reduce((acc, d) => acc + Number(d.amount), 0);
    return {
      completed: sum("completed"),
      processing: sum("processing") + sum("pending"),
      failed: sum("failed") + sum("cancelled") + sum("reversed"),
      count: deposits.length,
    };
  }, [deposits]);

  async function manage(d: AdminDeposit, action: string, extra?: Record<string, unknown>) {
    setBusyId(d.id);
    const { data, error } = await supabase.rpc("fn_admin_manage_deposit", {
      p_deposit_id: d.id,
      p_action: action,
      ...extra,
    });
    setBusyId(null);
    if (error) {
      toast.error("Action failed", { description: friendlyError(error) });
      return false;
    }
    toast.success(
      action === "approve"
        ? "Deposit approved and wallet credited"
        : action === "reject"
          ? "Deposit rejected"
          : action === "reverse"
            ? "Deposit reversed — funds removed from wallet"
            : "Deposit updated"
    );
    router.refresh();
    return data;
  }

  async function recheck(d: AdminDeposit) {
    setBusyId(d.id);
    try {
      const res = await fetch(`/api/deposits/${d.id}/recheck`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.status === "completed") {
        toast.success("Paynow confirms payment — deposit completed");
      } else {
        toast.info(`Still ${json.paynowStatus ?? json.status ?? "pending"}`, {
          description: json.note,
        });
      }
    } catch (e) {
      toast.error("Re-check failed", { description: friendlyError(e) });
    }
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Deposits</p>
          <p className="text-lg font-bold">{totals.count}</p>
        </Card>
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-lg font-bold text-primary">{formatMoney(totals.completed)}</p>
        </Card>
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">In flight</p>
          <p className="text-lg font-bold text-boost">{formatMoney(totals.processing)}</p>
        </Card>
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Failed/Reversed</p>
          <p className="text-lg font-bold text-destructive">{formatMoney(totals.failed)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, account # or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {filtered.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-0 sm:gap-3 sm:px-4 sm:py-3"
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-medium">
                {d.profiles?.full_name ?? "Unknown user"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  #{d.profiles?.account_number}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {d.provider === "paynow" ? "Paynow" : d.provider === "ecocash_direct" ? "EcoCash Instant" : d.provider}
                {" · "}
                {d.method.replace("_", " ")}
                {d.phone_number ? ` · ${d.phone_number}` : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {format(new Date(d.created_at), "d MMM yyyy, HH:mm")}
                {d.provider_transaction_id ? ` · ref ${d.provider_transaction_id}` : ""}
              </p>
            </div>
            <div className="w-20 text-right sm:w-24">
              <p className="text-sm font-bold tabular-nums">{formatMoney(Number(d.amount))}</p>
            </div>
            <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[d.status])}>
              {d.status}
            </Badge>
            <div className="flex items-center gap-1.5">
              {(d.status === "pending" || d.status === "processing" || d.status === "failed" || d.status === "cancelled") && (
                <>
                  {d.status === "processing" && d.provider === "paynow" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === d.id}
                      onClick={() => recheck(d)}
                    >
                      <RefreshCw className="size-3.5" />
                      Re-check
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === d.id}
                    onClick={() => setEditTarget(d)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busyId === d.id}
                    onClick={() => manage(d, "reject")}
                  >
                    Reject
                  </Button>
                  <Button size="sm" disabled={busyId === d.id} onClick={() => manage(d, "approve")}>
                    Approve
                  </Button>
                </>
              )}
              {d.status === "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={busyId === d.id}
                  onClick={() => setReverseTarget(d)}
                >
                  Reverse
                </Button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No deposits found.</p>
        )}
      </Card>

      <EditDepositDialog
        deposit={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={async (amount) => {
          const ok = await manage(editTarget!, "edit", { p_amount: amount });
          if (ok) setEditTarget(null);
        }}
      />
      <ReverseDepositDialog
        deposit={reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={async (note) => {
          const ok = await manage(reverseTarget!, "reverse", { p_note: note });
          if (ok) setReverseTarget(null);
        }}
      />
    </div>
  );
}

function EditDepositDialog({
  deposit,
  onClose,
  onSave,
}: {
  deposit: AdminDeposit | null;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (!deposit) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-sm sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit deposit</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {deposit.profiles?.full_name} · currently {formatMoney(Number(deposit.amount))}. Only
          unresolved deposits can be edited.
        </p>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Amount (USD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder={String(deposit.amount)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || !Number(amount)}
            onClick={async () => {
              setBusy(true);
              await onSave(Number(amount));
              setBusy(false);
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReverseDepositDialog({
  deposit,
  onClose,
  onConfirm,
}: {
  deposit: AdminDeposit | null;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!deposit) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-sm sm:p-6">
        <DialogHeader>
          <DialogTitle>Reverse deposit</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Removes {formatMoney(Number(deposit.amount))} from {deposit.profiles?.full_name}&apos;s
          wallet (principal). Fails if the money is already spent — resolve the shortfall via a
          manual adjustment first.
        </p>
        <Input
          placeholder="Reason (optional, audit-logged)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(note);
              setBusy(false);
            }}
          >
            Reverse {formatMoney(Number(deposit.amount))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
