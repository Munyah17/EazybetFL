import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ecocashCharge, normalizeMsisdn, isSuccessStatusMessage } from "@/lib/ecocash/client";
import { sendEmail } from "@/lib/email/send";
import { depositCompletedEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { rateLimited } from "@/lib/rate-limit";
import { MAX_SINGLE_DEPOSIT, MAX_DEPOSIT_ATTEMPTS_PER_HOUR } from "@/lib/deposit-limits";
import { checkResponsibleGamblingLimits } from "@/lib/responsible-gambling";
import { logError } from "@/lib/log";
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
  if (amount > MAX_SINGLE_DEPOSIT) {
    return NextResponse.json(
      { error: `Maximum deposit is ${formatMoney(MAX_SINGLE_DEPOSIT)} per transaction.` },
      { status: 400 }
    );
  }
  if (!phone) {
    return NextResponse.json({ error: "Enter your EcoCash number" }, { status: 400 });
  }

  const limited = await rateLimited(`deposit:${user.id}`, MAX_DEPOSIT_ATTEMPTS_PER_HOUR, 3600);
  if (limited) return limited;

  const blockedReason = await checkResponsibleGamblingLimits(supabase, user.id, amount);
  if (blockedReason) return NextResponse.json({ error: blockedReason }, { status: 403 });

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
    if (insertErr) console.error("[deposits/ecocash] insert failed:", insertErr.message);
    return NextResponse.json({ error: friendlyError(insertErr, "Could not start deposit") }, { status: 500 });
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
      // Isolated from the outer catch: a failed confirmation email must
      // never cause an already-completed deposit to be reported back to
      // the client as merely "pending" -- the wallet was already credited.
      try {
        if (user.email) {
          await sendEmail(user.email, "Deposit received", depositCompletedEmail(formatMoney(amount), "EcoCash"));
        }
      } catch (e) {
        await logError("api:deposits/ecocash", e, { depositId: deposit.id, step: "confirmation_email" });
      }
      return NextResponse.json({ status: "completed", depositId: deposit.id, amount });
    }

    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
    console.error("[deposits/ecocash] EcoCash returned:", charge.statusMessage);

    return NextResponse.json(
      {
        status: "failed",
        depositId: deposit.id,
        message: STATUS_MESSAGE_HINTS[charge.statusMessage] ?? "The payment could not be completed. Please try again.",
      },
      { status: 402 }
    );
  } catch (e) {
    // An exception here (timeout, network blip, malformed response) is
    // *our* side failing to confirm what happened -- it is not evidence
    // EcoCash didn't charge the user's phone. Marking this "failed" would
    // be a false failure: the money may already be gone from a real
    // account. Leave it "processing" (never touch its status here) and let
    // reconcileStuckDeposits re-verify the truth via an authenticated
    // ecocashLookup, same as any other stuck deposit -- exactly the
    // safety net that exists for this precise situation.
    await logError("api:deposits/ecocash", e, { depositId: deposit.id });
    return NextResponse.json(
      {
        status: "pending",
        depositId: deposit.id,
        message: "We couldn't confirm this payment yet. We'll update your wallet automatically once it clears -- check back shortly.",
      },
      { status: 202 }
    );
  }
}
