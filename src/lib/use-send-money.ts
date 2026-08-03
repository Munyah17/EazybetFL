"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";

/** Look up a recipient by account number before sending -- lets the UI
 * show a name to confirm against instead of sending blind to a typo'd
 * number. Returns null (no toast) for "not found" so the input can show
 * an inline state; other errors do toast. */
export function useLookupRecipient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function lookup(accountNumber: string): Promise<{ id: string; full_name: string } | null> {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_lookup_user_by_account_number", {
      p_account_number: accountNumber.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error("Could not look up that account number", { description: friendlyError(error) });
      return null;
    }
    return data as { id: string; full_name: string } | null;
  }

  return { lookup, loading };
}

export function useShareProfit() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function share(recipientAccountNumber: string, amount: number, note?: string): Promise<boolean> {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_share_profit", {
      p_recipient_account_number: recipientAccountNumber.trim(),
      p_amount: amount,
      p_note: note?.trim() || undefined,
    });
    setLoading(false);
    if (error) {
      toast.error("Could not send", { description: friendlyError(error) });
      return false;
    }
    const result = data as { blocked: boolean; reason?: string; recipient_name?: string };
    if (result.blocked) {
      toast.error("Can't share deposited funds", { description: friendlyError("SHARE_BLOCKED_PRINCIPAL") });
      return false;
    }
    toast.success(`Sent to ${result.recipient_name}`);
    return true;
  }

  return { share, loading };
}

export function useGiftVoucher() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function gift(recipientAccountNumber: string, amount: number): Promise<boolean> {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_gift_voucher", {
      p_recipient_account_number: recipientAccountNumber.trim(),
      p_amount: amount,
    });
    setLoading(false);
    if (error) {
      toast.error("Could not send voucher", { description: friendlyError(error) });
      return false;
    }
    const result = data as { recipient_name: string; code: string };
    toast.success(`Voucher sent to ${result.recipient_name}`);
    return true;
  }

  return { gift, loading };
}
