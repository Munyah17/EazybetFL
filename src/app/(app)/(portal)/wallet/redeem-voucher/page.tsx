"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRedeemVoucher } from "@/lib/use-redeem-voucher";

export default function RedeemVoucherPage() {
  const router = useRouter();
  const { redeem, loading } = useRedeemVoucher();
  const [code, setCode] = useState("");

  async function handleRedeem() {
    const ok = await redeem(code);
    if (ok) router.push("/wallet");
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Redeem Voucher" backHref="/wallet" />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Ticket className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Enter the code from your voucher to add its value straight to your wallet.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="voucher-code">Voucher Code</Label>
          <div className="flex gap-2">
            <Input
              id="voucher-code"
              placeholder="e.g. EZV7A8X3M2P9"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider"
            />
            <Button disabled={loading} onClick={handleRedeem} className="shrink-0">
              {loading ? "Redeeming…" : "Redeem"}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-card px-3.5 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>Vouchers can be bought from an EazyBet agent or in-store. Each code can only be redeemed once.</p>
        </div>
      </div>
    </div>
  );
}
