"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export function VerifyRequestForm({
  depositId,
  defaultAmount,
  defaultPhone,
}: {
  depositId: string;
  defaultAmount: number;
  defaultPhone: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(defaultAmount));
  const [phone, setPhone] = useState(defaultPhone);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!phone.trim()) {
      toast.error("Enter the EcoCash number you paid from");
      return;
    }
    if (!reference.trim()) {
      toast.error("Enter the reference from your confirmation SMS");
      return;
    }
    if (file) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error("Upload a photo or PDF of your confirmation");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error("File must be under 5 MB");
        return;
      }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("amount", amount);
      fd.set("phone", phone.trim());
      fd.set("reference", reference.trim());
      fd.set("note", note.trim());
      if (file) fd.set("proof", file);

      const res = await fetch(`/api/deposits/${depositId}/verify-request`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));

      if (data.status === "completed") {
        toast.success("Payment confirmed — wallet credited");
        router.push("/wallet");
        return;
      }
      if (!res.ok) {
        toast.error("Could not submit", { description: data.error });
        return;
      }
      toast.success("Verification requested", {
        description: "We'll email you once it's reviewed.",
      });
      router.push("/wallet");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="v-amount">Amount paid</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="v-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-6"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="v-phone">EcoCash number used</Label>
        <Input
          id="v-phone"
          placeholder="e.g. 0773 909 307"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="v-ref">Confirmation reference</Label>
        <Input
          id="v-ref"
          placeholder="From your EcoCash / Paynow SMS"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="v-proof">Screenshot / PDF of the confirmation (optional)</Label>
        <Input
          id="v-proof"
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="v-note">Anything else (optional)</Label>
        <Textarea
          id="v-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Extra detail that helps us match the payment"
        />
      </div>

      <Button size="lg" disabled={loading} onClick={submit} className="mt-1 w-full">
        {loading ? "Submitting…" : "Submit for verification"}
      </Button>
    </div>
  );
}
