"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

/** Shared "redeem a voucher by code" action -- credits the caller's own
 * wallet via fn_redeem_voucher, which enforces one redemption per code. */
export function useRedeemVoucher() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function redeem(code: string): Promise<boolean> {
    const target = code.trim();
    if (!target) {
      toast.error("Enter your voucher code");
      return false;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_redeem_voucher", { p_code: target });
    setLoading(false);

    if (error) {
      toast.error("Could not redeem voucher", { description: friendlyError(error) });
      return false;
    }

    const result = data as { amount: number; new_balance: number };
    toast.success(`Voucher redeemed: ${formatMoney(result.amount)} added to your wallet`);
    return true;
  }

  return { redeem, loading };
}
