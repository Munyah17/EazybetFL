import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { withdrawalDecisionEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

// Fired by an admin's browser right after fn_approve_withdrawal /
// fn_reject_withdrawal succeeds. The RPC itself already enforced the
// admin check and did the real state change -- this only sends the
// follow-up email, so it re-checks the caller is an admin and then
// looks up the withdrawal owner via the service-role client (the
// recipient is someone other than the caller, so RLS as the caller
// wouldn't see their profile).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const withdrawalId = String(body?.withdrawalId ?? "");
  const approved = Boolean(body?.approved);
  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  if (!withdrawalId) return NextResponse.json({ error: "Missing withdrawalId" }, { status: 400 });

  const admin = createAdminClient();
  const { data: withdrawal } = await admin
    .from("withdrawals")
    .select("amount, method, profiles!withdrawals_user_id_fkey(email)")
    .eq("id", withdrawalId)
    .maybeSingle();

  const email = withdrawal?.profiles?.email;
  if (withdrawal && email) {
    await sendEmail(
      email,
      approved ? "Withdrawal approved" : "Withdrawal rejected",
      withdrawalDecisionEmail(formatMoney(Number(withdrawal.amount)), approved, reason)
    );
  }

  return NextResponse.json({ ok: true });
}
