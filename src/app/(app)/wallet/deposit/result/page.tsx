"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-provider";
import { createClient } from "@/lib/supabase/client";

export default function DepositResultPage() {
  return (
    <Suspense>
      <ResultBody />
    </Suspense>
  );
}

function ResultBody() {
  const searchParams = useSearchParams();
  const urlDepositId = searchParams.get("depositId");
  const { refreshWallet } = useSession();
  const [status, setStatus] = useState<"checking" | "completed" | "failed" | "pending">("checking");

  useEffect(() => {
    // Polls an external system (Paynow, via our own API) for payment
    // status -- exactly what effects are for, not a plain state mirror.
    // Up to 30 tries, 3s apart (~90s total) -- long enough to cover normal
    // gateway confirmation latency without the user staring at a spinner
    // forever. If they close the tab before this resolves, the daily
    // deposit-reconciliation sweep (see sync-settlement) is the fallback
    // that stops a real payment from being permanently stuck as
    // "processing" just because nobody was watching this page.
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const check = async (depositId: string) => {
      attempts++;
      const res = await fetch(`/api/deposits/paynow/${depositId}/status`);
      const data = await res.json();
      if (data.status === "completed") {
        setStatus("completed");
        await refreshWallet();
      } else if (data.status === "failed") {
        setStatus("failed");
      } else if (attempts < MAX_ATTEMPTS) {
        setTimeout(() => check(depositId), 3000);
      } else {
        setStatus("pending");
      }
    };

    // depositId can go missing from the URL if the session dropped mid
    // checkout and the sign-in round trip lost it. Never assume "failed"
    // here -- we have no gateway confirmation either way, and claiming
    // failure for a payment that actually succeeded (or is still in
    // flight) is worse than an honest "we can't tell yet, check your
    // wallet." Fall back to the user's own most recent Paynow deposit
    // *regardless of its current status* -- filtering to "processing" only
    // used to miss a deposit a fast webhook had already completed by the
    // time this page ran its lookup, and report a successful deposit as
    // failed.
    (async () => {
      if (urlDepositId) {
        check(urlDepositId);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // No session to look anything up with -- not evidence of failure,
        // just evidence we can't check right now.
        setStatus("pending");
        return;
      }
      const { data: recent } = await supabase
        .from("deposits")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("provider", "paynow")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!recent) {
        // No deposit on record at all -- genuinely unknown, not a failure.
        setStatus("pending");
      } else if (recent.status === "completed") {
        setStatus("completed");
        await refreshWallet();
      } else if (recent.status === "failed") {
        setStatus("failed");
      } else {
        check(recent.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDepositId]);

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
