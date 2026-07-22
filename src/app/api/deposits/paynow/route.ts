import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paynowInitiate } from "@/lib/paynow/client";
import type { Database, Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
const SUPPORTED: PaymentMethod[] = ["onemoney", "visa", "mastercard", "bank_transfer", "innbucks"];

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
  if (!SUPPORTED.includes(method)) return NextResponse.json({ error: "Unsupported method" }, { status: 400 });

  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).single();
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 400 });

  const { data: deposit, error: insertErr } = await supabase
    .from("deposits")
    .insert({
      user_id: user.id,
      wallet_id: wallet.id,
      method,
      provider: "paynow",
      amount,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertErr || !deposit) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not start deposit" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const result = await paynowInitiate({
    reference: deposit.id,
    amount,
    authEmail: user.email ?? "player@eazybet.example",
    returnUrl: `${appUrl}/wallet/deposit/result?depositId=${deposit.id}`,
    resultUrl: `${appUrl}/api/webhooks/paynow`,
  });

  const admin = createAdminClient();

  if (result.status !== "Ok" || !result.browserurl) {
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
    return NextResponse.json({ error: result.error ?? "Paynow could not start this payment" }, { status: 502 });
  }

  await admin
    .from("deposits")
    .update({
      client_correlator: result.pollurl,
      provider_payload: result as unknown as Json,
    })
    .eq("id", deposit.id);

  return NextResponse.json({ depositId: deposit.id, browserUrl: result.browserurl });
}
