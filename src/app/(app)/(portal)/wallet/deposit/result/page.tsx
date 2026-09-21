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
  const token = searchParams.get("t");
  const { refreshWallet } = useSession();
  const [status, setStatus] = useState<"checking" | "completed" | "failed" | "pending">("checking");
  const [depositId, setDepositId] = useState<string | null>(urlDepositId);

  useEffect(() => {
    // Polls an external system (Paynow, via our own API) for payment
    // status. ~4 minutes total (60 tries, 4s apart) -- EcoCash USSD
    // approval plus Paynow settlement can genuinely take a couple of
    // minutes, longer than the old 90s window allowed for. If the user
    // closes the tab before this resolves, the daily deposit
    // reconciliation sweep and the manual verification request (button
    // shown below) are the fallbacks.
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    const tokenQuery = token ? `?t=${encodeURIComponent(token)}` : "";

    const check = async (id: string) => {
      if (cancelled) return;
      attempts++;
      setDepositId(id);
      let data: { status?: string } = {};
      try {
        const res = await fetch(`/api/deposits/paynow/${id}/status${tokenQuery}`);
        data = await res.json();
      } catch {
        // network blip -- treat as "keep waiting", never as failure
      }
      if (cancelled) return;
      if (data.status === "completed") {
        setStatus("completed");
        await refreshWallet();
      } else if (data.status === "failed") {
        setStatus("failed");
      } else if (attempts < MAX_ATTEMPTS) {
        setTimeout(() => check(id), 4000);
      } else {
        setStatus("pending");
      }
    };

    // depositId can go missing from the URL if the session dropped mid
    // checkout and the sign-in round trip lost it. Never assume "failed"
    // here -- we have no gateway confirmation either way. Fall back to the
    // user's own most recent Paynow deposit regardless of its current
    // status.
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
        setStatus("pending");
      } else if (recent.status === "completed") {
        setDepositId(recent.id);
        setStatus("completed");
        await refreshWallet();
      } else if (recent.status === "failed") {
        setDepositId(recent.id);
        setStatus("failed");
      } else {
        check(recent.id);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDepositId, token]);

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
            {depositId && <VerifyPrompt depositId={depositId} />}
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
            {depositId && <VerifyPrompt depositId={depositId} />}
          </>
        )}
      </div>
    </div>
  );
}

function VerifyPrompt({ depositId }: { depositId: string }) {
  return (
    <div className="mt-6 w-full max-w-sm rounded-xl border border-border/60 bg-card p-4 text-left">
      <p className="text-sm font-semibold">Already paid but not showing?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        If EcoCash deducted the money, send us the confirmation details and a screenshot. A team
        member will verify it and credit your wallet.
      </p>
      <Button asChild size="sm" className="mt-3">
        <Link href={`/wallet/verify/${depositId}`}>Request manual verification</Link>
      </Button>
    </div>
  );
}
