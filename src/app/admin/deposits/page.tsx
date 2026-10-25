import { createClient } from "@/lib/supabase/server";
import { DepositsManager, type AdminDeposit } from "@/components/admin/deposits-manager";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  const supabase = await createClient();
  const { data: deposits } = await supabase
    .from("deposits")
    .select(
      "id, amount, currency, method, provider, status, phone_number, paynow_reference, client_correlator, provider_transaction_id, created_at, completed_at, profiles!user_id ( full_name, email, account_number )"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Deposits</h1>
        <p className="text-sm text-muted-foreground">
          Every deposit attempt across all rails. Approve credits the wallet through the same
          verified path as the provider webhook — it cannot double-credit. Reverse claws a
          completed deposit back out of the wallet.
        </p>
      </div>
      <DepositsManager deposits={(deposits ?? []) as AdminDeposit[]} />
    </div>
  );
}
