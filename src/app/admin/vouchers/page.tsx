import { createClient } from "@/lib/supabase/server";
import { VoucherManager } from "@/components/admin/voucher-manager";

export default async function AdminVouchersPage() {
  const supabase = await createClient();
  const { data: vouchers } = await supabase
    .from("vouchers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const redeemerIds = [...new Set((vouchers ?? []).map((v) => v.redeemed_by).filter((id): id is string => !!id))];
  const { data: redeemers } = redeemerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", redeemerIds)
    : { data: [] };

  const redeemerNames = Object.fromEntries((redeemers ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Generate redeemable cash vouchers for agents or in-store sale. Each code credits a
          user&apos;s wallet once when redeemed.
        </p>
      </div>

      <VoucherManager initialVouchers={vouchers ?? []} redeemerNames={redeemerNames} />
    </div>
  );
}
