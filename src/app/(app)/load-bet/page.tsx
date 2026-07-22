"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QrCode, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLoadBookedBet } from "@/lib/use-load-booked-bet";

export default function LoadBetPage() {
  return (
    <Suspense>
      <LoadBetForm />
    </Suspense>
  );
}

function LoadBetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { load, loading } = useLoadBookedBet();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");

  async function handleLoad(codeToLoad?: string) {
    const ok = await load(codeToLoad ?? code);
    if (ok) router.push("/");
  }

  useEffect(() => {
    // One-time action on mount (RPC call), not a state mirror -- intentional.
    const fromQuery = searchParams.get("code");
    if (fromQuery) handleLoad(fromQuery.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col">
      <PageHeader title="Load Saved Bet" backHref="/" />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Bet Code / Voucher</Label>
          <div className="flex gap-2">
            <Input
              id="code"
              placeholder="Enter your bet code (e.g. EZY7A8X3M2)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider"
            />
            <Button disabled={loading} onClick={() => handleLoad()} className="shrink-0">
              {loading ? "Loading…" : "Load"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Card className="items-center gap-2 border-dashed border-border bg-card py-10 text-center">
          <QrCode className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Scan QR Code</p>
        </Card>

        <div className="flex items-start gap-2 rounded-xl bg-card px-3.5 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>You can find your bet code in the &quot;Book Bet&quot; section after saving a bet.</p>
        </div>
      </div>
    </div>
  );
}
