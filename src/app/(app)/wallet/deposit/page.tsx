"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Smartphone, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/session-provider";

// EcoCash Instant Payment (USSD/EIP) and Paynow are two separate, unrelated
// integrations -- EIP talks to EcoCash directly, Paynow is a gateway whose
// own hosted checkout lets the payer pick EcoCash/OneMoney/Visa/bank/etc.
// themselves. They used to be blurred together behind per-instrument
// choices that all secretly routed through the same Paynow redirect
// regardless of which one was picked. EcoCash Instant is disabled for now:
// no live API keys yet, only sandbox ones -- Paynow is fully activated.
const METHODS = [
  { id: "ecocash", label: "EcoCash Instant Payment", icon: Smartphone, needsPhone: true, disabled: true },
  { id: "paynow", label: "Paynow", icon: CreditCard, needsPhone: false, disabled: false },
] as const;

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function DepositPage() {
  const router = useRouter();
  const { refreshWallet } = useSession();
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("paynow");
  const [amount, setAmount] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = METHODS.find((m) => m.id === method)!;

  async function handleDeposit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (selected.needsPhone && !phone) {
      toast.error("Enter your EcoCash number");
      return;
    }

    setLoading(true);
    try {
      if (method === "ecocash") {
        const res = await fetch("/api/deposits/ecocash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, phone }),
        });
        const data = await res.json();
        // Check `data.status` explicitly rather than `res.ok` -- a "still
        // confirming" response is a 2xx (so res.ok is true) but is not a
        // success, and must never be presented as one.
        if (data.status === "completed") {
          toast.success("Deposit successful!", { description: `${amt} added to your wallet.` });
          await refreshWallet();
          router.push("/wallet");
        } else if (data.status === "pending") {
          toast.info("Still confirming your payment", { description: data.message });
          router.push("/wallet");
        } else {
          toast.error("Deposit failed", { description: data.message ?? data.error });
        }
      } else {
        const res = await fetch("/api/deposits/paynow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, method: "paynow" }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error("Deposit failed", { description: data.error });
          return;
        }
        window.location.href = data.browserUrl;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Deposit" backHref="/wallet" />

      <div className="flex flex-col gap-4 p-4">
        <div>
          <Label className="mb-2 block text-sm font-semibold">Select Payment Method</Label>
          <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
            {METHODS.map((m) => (
              <button
                key={m.id}
                disabled={m.disabled}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 hover:bg-accent",
                  m.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                )}
              >
                <m.icon className="size-4.5 text-muted-foreground" />
                <span className="flex-1 text-left text-sm font-medium">
                  {m.label}
                  {m.disabled && <span className="ml-2 text-xs font-normal text-muted-foreground">(Temporarily unavailable)</span>}
                </span>
                <span
                  className={cn(
                    "flex size-4.5 items-center justify-center rounded-full border-2 border-border",
                    method === m.id && "border-primary bg-primary"
                  )}
                />
              </button>
            ))}
          </Card>
        </div>

        {selected.needsPhone && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">EcoCash Number</Label>
            <Input
              id="phone"
              placeholder="e.g. 0773 909 307"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="amount"
              type="number"
              min={1}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-6"
            />
          </div>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className="rounded-lg bg-secondary py-2 text-sm font-semibold hover:bg-accent"
              >
                ${a}
              </button>
            ))}
          </div>
        </div>

        <Button size="lg" disabled={loading} onClick={handleDeposit} className="mt-2 w-full">
          {loading ? "Processing…" : "Deposit Now"}
        </Button>
      </div>
    </div>
  );
}
