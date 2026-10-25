import { createAdminClient } from "@/lib/supabase/admin";
import {
  PaymentMethodsManager,
  type PaymentMethodSetting,
} from "@/components/super-admin/payment-methods-manager";

export const dynamic = "force-dynamic";

export default async function PaymentMethodsPage() {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("payment_method_settings")
    .select("method, label, enabled, note, updated_at")
    .order("label");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Payment Methods</h1>
        <p className="text-sm text-muted-foreground">
          Switch deposit rails on or off. Changes take effect immediately on the deposit page and
          in the deposit API. EcoCash Instant also requires the EIP credentials to be present in
          the server environment — the toggle stays inert without them.
        </p>
      </div>
      <PaymentMethodsManager settings={(settings ?? []) as PaymentMethodSetting[]} />
    </div>
  );
}
