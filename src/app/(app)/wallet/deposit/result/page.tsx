"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-provider";

export default function DepositResultPage() {
  return (
    <Suspense>
      <ResultBody />
    </Suspense>
  );
}

function ResultBody() {
  const searchParams = useSearchParams();
  const depositId = searchParams.get("depositId");
  const { refreshWallet } = useSession();
  const [status, setStatus] = useState<"checking" | "completed" | "failed" | "pending">("checking");

  useEffect(() => {
    // Polls an external system (Paynow, via our own API) for payment
    // status -- exactly what effects are for, not a plain state mirror.
    if (!depositId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("failed");
      return;
    }
    let attempts = 0;
    const check = async () => {
      attempts++;
      const res = await fetch(`/api/deposits/paynow/${depositId}/status`);
      const data = await res.json();
      if (data.status === "completed") {
        setStatus("completed");
        await refreshWallet();
      } else if (data.status === "failed") {
        setStatus("failed");
      } else if (attempts < 8) {
        setTimeout(check, 2500);
      } else {
        setStatus("pending");
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositId]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Deposit" backHref="/wallet" />
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        {status === "checking" && (
          <>
            <Loader2 className="size-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Confirming your payment…</p>
          </>
        )}
        {status === "completed" && (
          <>
            <CheckCircle2 className="size-14 text-primary" />
            <p className="text-lg font-bold">Deposit successful!</p>
            <Button asChild className="mt-2">
              <Link href="/wallet">Back to Wallet</Link>
            </Button>
          </>
        )}
        {status === "failed" && (
          <>
            <XCircle className="size-14 text-destructive" />
            <p className="text-lg font-bold">Deposit failed</p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/wallet/deposit">Try Again</Link>
            </Button>
          </>
        )}
        {status === "pending" && (
          <>
            <Loader2 className="size-12 text-boost" />
            <p className="text-lg font-bold">Still processing</p>
            <p className="text-sm text-muted-foreground">
              We&apos;ll update your balance as soon as it clears. Check your wallet shortly.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/wallet">Back to Wallet</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
