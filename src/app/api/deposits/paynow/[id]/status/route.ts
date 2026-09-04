import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paynowPoll, isPaynowPaid } from "@/lib/paynow/client";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("t");

  // Two ways to be authorized for a deposit's status:
  //  - a live session that owns it (the normal in-app case), or
  //  - the per-deposit `verify_token` minted at initiation and carried on
  //    the Paynow return URL (covers the session being lost on the round
  //    trip through Paynow's hosted page -- EcoCash in-app browser, ITP).
  // The token is single-deposit-scoped and unguessable, so it leaks
  // nothing beyond "is this one payment done yet".
  const admin = createAdminClient();

  let deposit:
    | { id: string; status: string; client_correlator: string | null; user_id: string; verify_token: string | null }
    | null = null;

  if (token) {
    const { data } = await admin
      .from("deposits")
      .select("id, status, client_correlator, user_id, verify_token")
      .eq("id", id)
      .maybeSingle();
    if (data && data.verify_token && data.verify_token === token) {
      deposit = data;
    }
  }

  if (!deposit) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data } = await supabase
      .from("deposits")
      .select("id, status, client_correlator, user_id, verify_token")
      .eq("id", id)
      .single();
    if (!data || data.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    deposit = data;
  }

  if (deposit.status === "completed") return NextResponse.json({ status: "completed" });
  if (deposit.status === "failed") return NextResponse.json({ status: "failed" });
  if (!deposit.client_correlator) return NextResponse.json({ status: deposit.status });

  // A poll failure (timeout, Paynow outage, DNS blip) must never be read as
  // "not paid" -- the whole point of this route is telling a waiting user
  // whether their money is safe. Degrade to "pending" (the client already
  // retries this endpoint every few seconds) and log it, rather than
  // silently losing the check or crashing to a bare 500.
  let poll;
  try {
    poll = await paynowPoll(deposit.client_correlator);
  } catch (e) {
    await logError("api:deposits/paynow/status", e, { depositId: deposit.id });
    return NextResponse.json({ status: "pending" });
  }

  if (isPaynowPaid(poll.status ?? "")) {
    const { error } = await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
    if (error) {
      await logError("api:deposits/paynow/status", error.message, { depositId: deposit.id, step: "fn_complete_deposit" });
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({ status: "completed" });
  }
  if ((poll.status ?? "").toLowerCase() === "cancelled") {
    const { error } = await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    if (error) await logError("api:deposits/paynow/status", error.message, { depositId: deposit.id, step: "fn_fail_deposit" });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "pending" });
}
