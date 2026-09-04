import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DepositVerificationRow } from "@/components/super-admin/deposit-verification-row";

export const dynamic = "force-dynamic";

export default async function DepositVerificationsPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("deposit_verification_requests")
    .select(
      "id, deposit_id, amount_claimed, payer_phone, payer_reference, proof_path, note, status, admin_note, reviewed_at, created_at, deposits(amount, status, method, provider, client_correlator, provider_payload, created_at), profiles(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  // Sign the proof object paths server-side -- the bucket is private.
  const admin = createAdminClient();
  const signed: Record<string, string> = {};
  for (const r of requests ?? []) {
    if (r.proof_path) {
      const { data } = await admin.storage.from("deposit-proofs").createSignedUrl(r.proof_path, 60 * 30);
      if (data?.signedUrl) signed[r.id] = data.signedUrl;
    }
  }

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const reviewed = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">Deposit Verifications</h1>
        <p className="text-sm text-muted-foreground">
          Players reporting a Paynow payment that never credited. Re-check the gateway first;
          approve only against real proof. Approving credits the wallet through the same path the
          webhook uses — it will not double-credit a deposit that already completed.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Pending ({pending.length})</h2>
        {pending.map((r) => (
          <DepositVerificationRow key={r.id} request={r} proofUrl={signed[r.id]} />
        ))}
        {!pending.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing awaiting review.</p>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Reviewed</h2>
          {reviewed.map((r) => (
            <DepositVerificationRow key={r.id} request={r} proofUrl={signed[r.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
