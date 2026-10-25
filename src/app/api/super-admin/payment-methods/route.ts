import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

// Payment-rail on/off switches. Super-admin only -- a flipped toggle
// changes live money flows, so it needs the highest role plus an audit row.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const method = typeof body?.method === "string" ? body.method.trim() : "";
  const enabled = body?.enabled === true;
  if (!method) return NextResponse.json({ error: "Missing method" }, { status: 400 });

  const admin = createAdminClient();

  // Guard rail: EcoCash Instant may only be switched on when the EIP
  // credentials actually exist server-side -- otherwise the route would
  // accept deposits and every charge call would 502.
  if (method === "ecocash_instant" && enabled) {
    const configured =
      !!process.env.ECOCASH_EIP_BASE_URL &&
      !!process.env.ECOCASH_EIP_BASIC_AUTH_USERNAME &&
      !!process.env.ECOCASH_EIP_BASIC_AUTH_PASSWORD;
    if (!configured) {
      return NextResponse.json(
        {
          error:
            "EcoCash EIP credentials are not configured on the server. Set ECOCASH_EIP_* env vars first.",
        },
        { status: 400 }
      );
    }
  }

  const { data, error } = await admin
    .from("payment_method_settings")
    .update({ enabled, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("method", method)
    .select("method, enabled")
    .maybeSingle();

  if (error) {
    await logError("api:super-admin/payment-methods", error.message, { method });
    return NextResponse.json({ error: "Could not update setting" }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Unknown payment method" }, { status: 404 });

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: "super_admin",
    action: "payment_method_toggle",
    entity_type: "payment_method_settings",
    entity_id: null,
    new_values: { method, enabled },
  });

  return NextResponse.json(data);
}
