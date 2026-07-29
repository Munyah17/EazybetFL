"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

type Customer = { id: string; full_name: string; phone: string | null; email: string | null; balance: number };

export function CustomerRow({ customer }: { customer: Customer }) {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  function close() {
    setMode(null);
    setAmount("");
  }

  async function confirm() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);
    const rpc = mode === "deposit" ? "fn_agent_deposit_customer" : "fn_agent_withdraw_customer";
    const { error } = await supabase.rpc(rpc, { p_customer_id: customer.id, p_amount: value });
    setLoading(false);
    if (error) {
      toast.error(mode === "deposit" ? "Could not process deposit" : "Could not process withdrawal", {
        description: friendlyError(error),
      });
      return;
    }
    toast.success(mode === "deposit" ? "Deposit processed" : "Withdrawal processed");
    close();
    router.refresh();
  }

  return (
    <>
      <Card className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{customer.full_name}</p>
          <p className="text-xs text-muted-foreground">{customer.phone ?? customer.email}</p>
          <p className="text-xs text-muted-foreground">Balance: {formatMoney(customer.balance)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setMode("withdraw")}>
            Withdraw
          </Button>
          <Button size="sm" onClick={() => setMode("deposit")}>
            Deposit
          </Button>
        </div>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mode === "deposit" ? "Cash deposit for " : "Cash withdrawal for "}
              {customer.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-amount">Amount</Label>
            <Input
              id="agent-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {mode === "deposit"
                ? "Debited from your float, credited to the customer's wallet."
                : "Debited from the customer's wallet, credited to your float."}
            </p>
          </div>

          <DialogFooter>
            <Button className="w-full" disabled={loading} onClick={confirm}>
              {loading ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
