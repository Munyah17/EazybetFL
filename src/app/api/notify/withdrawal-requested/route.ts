import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { withdrawalRequestedEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  ecocash: "EcoCash",
  onemoney: "OneMoney",
  innbucks: "InnBucks",
  bank_transfer: "Bank Transfer",
};

// Fired by the client right after fn_request_withdrawal succeeds. Only
// trusts the caller's own authenticated session for the destination
// address; the amount is caller-supplied but only affects the wording
// of an email sent to that same account, so a mismatched amount here
// has no security consequence.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const method = String(body?.method ?? "");
  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  await sendEmail(
    user.email,
    "Withdrawal requested",
    withdrawalRequestedEmail(formatMoney(amount), METHOD_LABELS[method] ?? method)
  );

  return NextResponse.json({ ok: true });
}
