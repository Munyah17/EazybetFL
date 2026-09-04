import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paynowInitiate } from "@/lib/paynow/client";
import { friendlyError } from "@/lib/friendly-error";
import { logWarn } from "@/lib/log";
import { getAppBaseUrl } from "@/lib/app-url";
import { formatMoney } from "@/lib/format";
import { rateLimited } from "@/lib/rate-limit";
import { MAX_SINGLE_DEPOSIT, MAX_DEPOSIT_ATTEMPTS_PER_HOUR } from "@/lib/deposit-limits";
import { checkResponsibleGamblingLimits } from "@/lib/responsible-gambling";
import type { Database, Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
// Paynow's hosted checkout is where the payer actually picks their
// instrument (EcoCash, OneMoney, Visa, bank, etc.) -- we never send a
// pre-selected one, so "paynow" is the only method this route issues today.
// The older per-instrument values stay accepted so a stale client tab from
// before this change doesn't get a hard failure mid-deposit.
const SUPPORTED: PaymentMethod[] = ["paynow", "onemoney", "visa", "mastercard", "bank_transfer", "innbucks"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const method = body?.method as PaymentMethod;

  if (!amount || amount <= 0) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  if (amount > MAX_SINGLE_DEPOSIT) {
    return NextResponse.json(
      { error: `Maximum deposit is ${formatMoney(MAX_SINGLE_DEPOSIT)} per transaction.` },
      { status: 400 }
    );
  }
  if (!SUPPORTED.includes(method)) return NextResponse.json({ error: "Unsupported method" }, { status: 400 });

  const limited = await rateLimited(`deposit:${user.id}`, MAX_DEPOSIT_ATTEMPTS_PER_HOUR, 3600);
  if (limited) return limited;

  const blockedReason = await checkResponsibleGamblingLimits(supabase, user.id, amount);
  if (blockedReason) return NextResponse.json({ error: blockedReason }, { status: 403 });

  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).single();
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 400 });

  // Per-deposit random token. Carried on the Paynow return URL so the
  // result page can poll this one deposit's status even when the session
  // cookie was lost on the round trip through Paynow's hosted page.
  const verifyToken = crypto.randomBytes(24).toString("base64url");

  const { data: deposit, error: insertErr } = await supabase
    .from("deposits")
    .insert({
      user_id: user.id,
      wallet_id: wallet.id,
      method,
      provider: "paynow",
      amount,
      status: "processing",
      verify_token: verifyToken,
    })
    .select("id")
    .single();

  if (insertErr || !deposit) {
    if (insertErr) console.error("[deposits/paynow] insert failed:", insertErr.message);
    return NextResponse.json({ error: friendlyError(insertErr, "Could not start deposit") }, { status: 500 });
  }

  // Derived from the request host when NEXT_PUBLIC_APP_URL isn't usefully
  // set -- so Paynow's resultUrl (its server-to-server confirmation) can
  // never silently point at localhost.
  const appUrl = getAppBaseUrl(req);
  if (/localhost|127\.0\.0\.1/.test(appUrl)) {
    await logWarn("api:deposits/paynow", "could not resolve a public app URL -- Paynow callbacks will fail", {
      depositId: deposit.id,
    });
  }

  const result = await paynowInitiate({
    reference: deposit.id,
    amount,
    authEmail: user.email ?? "player@eazybet.example",
    returnUrl: `${appUrl}/wallet/deposit/result?depositId=${deposit.id}&t=${verifyToken}`,
    resultUrl: `${appUrl}/api/webhooks/paynow`,
  });

  const admin = createAdminClient();

  if (result.status !== "Ok" || !result.browserurl) {
    console.error("[deposits/paynow] Paynow rejected the request:", result.error);
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
    return NextResponse.json({ error: "Paynow could not start this payment. Please try again shortly." }, { status: 502 });
  }

  await admin
    .from("deposits")
    .update({
      client_correlator: result.pollurl,
      provider_payload: result as unknown as Json,
    })
    .eq("id", deposit.id);

  return NextResponse.json({ depositId: deposit.id, browserUrl: result.browserurl, verifyToken });
}
