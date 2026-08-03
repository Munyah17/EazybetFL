"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLookupRecipient, useShareProfit, useGiftVoucher } from "@/lib/use-send-money";

export default function SendMoneyPage() {
  const router = useRouter();
  const { lookup, loading: looking } = useLookupRecipient();
  const { share, loading: sharing } = useShareProfit();
  const { gift, loading: gifting } = useGiftVoucher();

  const [accountNumber, setAccountNumber] = useState("");
  const [recipient, setRecipient] = useState<{ id: string; full_name: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function handleFind() {
    setRecipient(null);
    if (!accountNumber.trim()) return;
    const found = await lookup(accountNumber);
    if (!found) {
      setRecipient(null);
    } else {
      setRecipient(found);
    }
  }

  async function handleShare() {
    const parsed = Number(amount);
    if (!recipient || !parsed || parsed <= 0) return;
    const ok = await share(accountNumber, parsed, note);
    if (ok) router.push("/wallet");
  }

  async function handleGift() {
    const parsed = Number(amount);
    if (!recipient || !parsed || parsed <= 0) return;
    const ok = await gift(accountNumber, parsed);
    if (ok) router.push("/wallet");
  }

  const busy = sharing || gifting;

  return (
    <div className="flex flex-col">
      <PageHeader title="Send to a Friend" backHref="/wallet" />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-number">Their Account Number</Label>
          <div className="flex gap-2">
            <Input
              id="account-number"
              placeholder="e.g. 4821093756"
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value);
                setRecipient(null);
              }}
              className="font-mono tracking-wider"
            />
            <Button variant="outline" disabled={looking} onClick={handleFind} className="shrink-0">
              {looking ? "Finding…" : "Find"}
            </Button>
          </div>
          {recipient && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <CheckCircle2 className="size-4" /> {recipient.full_name}
            </p>
          )}
        </div>

        <Tabs defaultValue="share">
          <TabsList className="w-full">
            <TabsTrigger value="share" className="flex-1">
              Share Winnings
            </TabsTrigger>
            <TabsTrigger value="voucher" className="flex-1">
              Gift a Voucher
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-amount">Amount</Label>
              <Input
                id="share-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" placeholder="Nice one!" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button disabled={!recipient || busy} onClick={handleShare}>
              {sharing ? "Sending…" : "Send"}
            </Button>
            <p className="flex items-start gap-2 rounded-xl bg-card px-3.5 py-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Only your winnings can be shared this way. Deposited funds can&apos;t be
              sent as cash — use Gift a Voucher instead.
            </p>
          </TabsContent>

          <TabsContent value="voucher" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="voucher-amount">Amount</Label>
              <Input
                id="voucher-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <Button disabled={!recipient || busy} onClick={handleGift}>
              {gifting ? "Sending…" : "Send Voucher"}
            </Button>
            <p className="flex items-start gap-2 rounded-xl bg-card px-3.5 py-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              They can use this voucher to place bets, but it can&apos;t be withdrawn.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
