import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ecocashCharge, normalizeMsisdn, isSuccessStatusMessage } from "@/lib/ecocash/client";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUS_MESSAGE_HINTS: Record<string, string> = {
  "Insufficient Balance": "Insufficient EcoCash balance. Top up your wallet and try again.",
  "Transaction Failed - Invalid PIN": "Incorrect PIN entered on the USSD prompt. Please try again.",
  "Transaction Limit Exceeded": "This exceeds your EcoCash transaction limit.",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const phone = String(body?.phone ?? "");

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Enter your EcoCash number" }, { status: 400 });
  }

  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).single();
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 400 });

  const clientCorrelator = `EZY${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const endUserId = normalizeMsisdn(phone);

  const { data: deposit, error: insertErr } = await supabase
    .from("deposits")
    .insert({
      user_id: user.id,
      wallet_id: wallet.id,
      method: "ecocash",
      provider: "ecocash_direct",
      amount,
      phone_number: phone,
      client_correlator: clientCorrelator,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertErr || !deposit) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not start deposit" }, { status: 500 });
  }

  const admin = createAdminClient();

  try {
    const charge = await ecocashCharge({
      clientCorrelator,
      referenceCode: deposit.id,
      endUserId,
      amount,
      notifyUrl: process.env.ECOCASH_NOTIFY_URL,
    });

    await admin
      .from("deposits")
      .update({
        provider_transaction_id: charge.transactionId ?? null,
        provider_payload: charge as unknown as Json,
      })
      .eq("id", deposit.id);

    if (isSuccessStatusMessage(charge.statusMessage)) {
      await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
      return NextResponse.json({ status: "completed", depositId: deposit.id, amount });
    }

    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);

    return NextResponse.json(
      {
        status: "failed",
        depositId: deposit.id,
        message: STATUS_MESSAGE_HINTS[charge.statusMessage] ?? charge.statusMessage,
      },
      { status: 402 }
    );
  } catch (e) {
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
