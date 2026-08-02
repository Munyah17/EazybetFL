"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, Ban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { friendlyError } from "@/lib/friendly-error";
import { formatMoney } from "@/lib/format";
import { logAudit } from "@/lib/audit-log";

type Voucher = Database["public"]["Tables"]["vouchers"]["Row"];

const STATUS_VARIANT: Record<Voucher["status"], "default" | "secondary" | "destructive"> = {
  active: "default",
  redeemed: "secondary",
  void: "destructive",
};

export function VoucherManager({
  initialVouchers,
  redeemerNames,
}: {
  initialVouchers: Voucher[];
  redeemerNames: Record<string, string>;
}) {
  const supabase = createClient();
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [justGenerated, setJustGenerated] = useState<Voucher[] | null>(null);

  async function handleGenerate() {
    const parsedAmount = Number(amount);
    const parsedCount = Number(count);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!parsedCount || parsedCount < 1 || parsedCount > 100) {
      toast.error("Enter a quantity between 1 and 100");
      return;
    }

    setGenerating(true);
    const { data, error } = await supabase.rpc("fn_generate_vouchers", {
      p_amount: parsedAmount,
      p_count: parsedCount,
      p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
    setGenerating(false);

    if (error) {
      toast.error("Could not generate vouchers", { description: friendlyError(error) });
      return;
    }

    const created = data as Voucher[];
    setVouchers((prev) => [...created, ...prev]);
    setJustGenerated(created);
    setOpen(false);
    setAmount("");
    setCount("1");
    setExpiresAt("");
    logAudit("voucher_batch_generated", "voucher", undefined, undefined, {
      count: parsedCount,
      amount: parsedAmount,
    });
    toast.success(`${created.length} voucher${created.length > 1 ? "s" : ""} generated`);
  }

  async function handleVoid(v: Voucher) {
    const { error } = await supabase.rpc("fn_void_voucher", { p_voucher_id: v.id });
    if (error) {
      toast.error("Could not void voucher", { description: friendlyError(error) });
      return;
    }
    setVouchers((prev) => prev.map((x) => (x.id === v.id ? { ...x, status: "void" } : x)));
    logAudit("voucher_voided", "voucher", v.id);
    toast.success("Voucher voided");
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  }

  function copyAllGenerated() {
    if (!justGenerated) return;
    navigator.clipboard.writeText(justGenerated.map((v) => v.code).join("\n"));
    toast.success("All codes copied");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Voucher Batches</h2>
          <p className="text-xs text-muted-foreground">Most recent 200 vouchers, newest first.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Generate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Generate Vouchers</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="voucher-amount">Amount per voucher *</Label>
                <Input
                  id="voucher-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10.00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="voucher-count">Quantity</Label>
                <Input
                  id="voucher-count"
                  type="number"
                  min="1"
                  max="100"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="voucher-expires">Expires (optional)</Label>
                <Input
                  id="voucher-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button disabled={generating} onClick={handleGenerate} className="w-full">
                {generating ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {justGenerated && (
        <Card className="gap-2 border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {justGenerated.length} code{justGenerated.length > 1 ? "s" : ""} generated
            </p>
            <Button variant="outline" size="sm" onClick={copyAllGenerated}>
              <Copy className="size-3.5" /> Copy All
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {justGenerated.map((v) => (
              <Badge key={v.id} variant="secondary" className="font-mono">
                {v.code}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {vouchers.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No vouchers yet.</p>
        ) : (
          vouchers.map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium">{v.code}</span>
                  <Badge variant={STATUS_VARIANT[v.status]} className="shrink-0 capitalize">
                    {v.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(v.amount)}
                  {v.redeemed_by && ` · redeemed by ${redeemerNames[v.redeemed_by] ?? "unknown"}`}
                  {v.expires_at && v.status === "active" && ` · expires ${new Date(v.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => copyCode(v.code)} aria-label="Copy code">
                <Copy className="size-4" />
              </Button>
              {v.status === "active" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => handleVoid(v)}
                  aria-label="Void voucher"
                >
                  <Ban className="size-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
