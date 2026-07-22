"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/lib/auth/session-provider";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "ecocash", label: "EcoCash" },
  { id: "onemoney", label: "OneMoney" },
  { id: "innbucks", label: "InnBucks" },
  { id: "bank_transfer", label: "Bank Transfer" },
];

const MIN_WITHDRAWAL = 5;

export default function WithdrawPage() {
  const router = useRouter();
  const supabase = createClient();
  const { wallet, refreshWallet } = useSession();

  const [method, setMethod] = useState<PaymentMethod>("ecocash");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const balance = wallet?.balance ?? 0;
  const amt = Number(amount) || 0;

  async function handleSubmit() {
    if (amt < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ${formatMoney(MIN_WITHDRAWAL)}`);
      return;
    }
    if (amt > balance) {
      toast.error("Insufficient balance");
      return;
    }
    if (!phone) {
      toast.error("Enter your phone number");
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc("fn_request_withdrawal", {
      p_amount: amt,
      p_method: method,
      p_destination: { phone },
    });
    setLoading(false);

    if (error) {
      toast.error("Withdrawal request failed", { description: error.message });
      return;
    }

    toast.success("Withdrawal requested", {
      description: "We'll process it within 1-2 hours.",
    });
    await refreshWallet();
    router.push("/wallet");
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Withdraw" backHref="/wallet" />

      <div className="flex flex-col gap-4 p-4">
        <Card className="border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-extrabold text-primary">{formatMoney(balance)}</p>
        </Card>

        <div className="flex flex-col gap-1.5">
          <Label>Withdrawal Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wphone">Phone Number</Label>
          <Input
            id="wphone"
            placeholder="e.g. 0773 909 307"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="wamount">Amount</Label>
            <span className="text-xs text-muted-foreground">Min: {formatMoney(MIN_WITHDRAWAL)}</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="wamount"
              type="number"
              min={MIN_WITHDRAWAL}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-6"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">You will receive</span>
          <span className="text-base font-bold text-primary">{formatMoney(amt)}</span>
        </div>

        <Button size="lg" disabled={loading} onClick={handleSubmit} className="w-full">
          {loading ? "Submitting…" : "Submit Withdrawal"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Withdrawals are processed within 1-2 hours.
        </p>
      </div>
    </div>
  );
}
