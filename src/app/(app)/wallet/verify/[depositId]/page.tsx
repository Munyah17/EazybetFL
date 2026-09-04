import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { VerifyRequestForm } from "@/components/wallet/verify-request-form";

export default async function DepositVerifyPage({
  params,
}: {
  params: Promise<{ depositId: string }>;
}) {
  const { depositId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/wallet/verify/${depositId}`);

  const { data: deposit } = await supabase
    .from("deposits")
    .select("id, amount, status, method, phone_number, created_at, user_id")
    .eq("id", depositId)
    .maybeSingle();

  if (!deposit || deposit.user_id !== user.id) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Verify deposit" backHref="/wallet" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          We couldn&apos;t find that deposit.
        </div>
      </div>
    );
  }

  if (deposit.status === "completed") {
    return (
      <div className="flex flex-col">
        <PageHeader title="Verify deposit" backHref="/wallet" />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <CheckCircle2 className="size-12 text-primary" />
          <p className="text-lg font-bold">This deposit is already credited</p>
          <p className="text-sm text-muted-foreground">
            {formatMoney(Number(deposit.amount))} is in your wallet.
          </p>
          <Button asChild className="mt-2">
            <Link href="/wallet">Back to Wallet</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { data: existing } = await supabase
    .from("deposit_verification_requests")
    .select("id, status, created_at, admin_note")
    .eq("deposit_id", depositId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col">
      <PageHeader title="Verify deposit" backHref="/wallet" />
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Deposit</p>
          <p className="text-lg font-bold">{formatMoney(Number(deposit.amount))}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(deposit.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {deposit.status}
          </p>
        </div>

        {existing && existing.status === "pending" ? (
          <div className="rounded-xl border border-boost/40 bg-boost/10 p-4 text-sm">
            <p className="font-semibold">Verification already requested</p>
            <p className="mt-1 text-muted-foreground">
              Our team is reviewing it. You&apos;ll get an email once it&apos;s done — usually within a
              few hours.
            </p>
          </div>
        ) : existing && existing.status === "rejected" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold">A previous request was not approved</p>
            {existing.admin_note && <p className="mt-1 text-muted-foreground">{existing.admin_note}</p>}
            <p className="mt-2 text-muted-foreground">
              If you have new proof of payment, you can submit again below.
            </p>
          </div>
        ) : null}

        {(!existing || existing.status !== "pending") && (
          <VerifyRequestForm
            depositId={deposit.id}
            defaultAmount={Number(deposit.amount)}
            defaultPhone={deposit.phone_number ?? ""}
          />
        )}
      </div>
    </div>
  );
}
