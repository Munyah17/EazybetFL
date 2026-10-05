import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

type WalletBucket = "balance" | "principal";

type ActionBody =
  | { action: "wallet_adjust"; direction: "credit" | "debit"; bucket: WalletBucket; amount: number; description: string }
  | { action: "set_password"; password: string }
  | { action: "revoke_sessions" }
  | { action: "send_notification"; title: string; message: string }
  | { action: "delete_account" };

async function audit(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  action: string,
  entityId: string,
  newValues?: Record<string, unknown>
) {
  // fn_write_audit_log resolves the actor from auth.uid(), which is null
  // under the service role -- write the row directly so the actor is right.
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    actor_role: "super_admin",
    action,
    entity_type: "profile",
    entity_id: entityId,
    new_values: (newValues ?? {}) as Json,
  });
}

// Privileged super-admin operations on a single user. Everything here needs
// the service role (wallet primitives are service_role-only, auth admin API,
// audit writes with an explicit actor). Caller identity is verified first.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  let body: ActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    switch (body.action) {
      case "wallet_adjust": {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
          return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
        }
        const bucket: WalletBucket = body.bucket === "principal" ? "principal" : "balance";
        const description =
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim().slice(0, 200)
            : `Manual ${body.direction} by super admin`;

        const fn = body.direction === "credit" ? "fn_wallet_credit" : "fn_wallet_debit";
        const { error } = await admin.rpc(fn, {
          p_user_id: id,
          p_amount: amount,
          p_type: "adjustment",
          p_reference_type: "manual_adjustment",
          // No linked entity for a manual adjustment; the column is a
          // required uuid, so use the nil uuid as a neutral marker.
          p_reference_id: "00000000-0000-0000-0000-000000000000",
          p_description: description,
          p_created_by: user.id,
          p_bucket: bucket,
        });
        if (error) {
          await logError("api:super-admin/users wallet_adjust", error.message, { id });
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        await audit(admin, user.id, "wallet_adjust", id, {
          direction: body.direction,
          bucket,
          amount,
          description,
        });
        const { data: wallet } = await admin
          .from("wallets")
          .select("balance, principal_balance, bonus_balance, locked_balance, currency")
          .eq("user_id", id)
          .single();
        return NextResponse.json({ ok: true, wallet });
      }

      case "set_password": {
        const password = typeof body.password === "string" ? body.password : "";
        if (password.length < 6) {
          return NextResponse.json(
            { error: "Password must be at least 6 characters" },
            { status: 400 }
          );
        }
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) {
          await logError("api:super-admin/users set_password", error.message, { id });
          return NextResponse.json({ error: "Could not set password" }, { status: 400 });
        }
        await audit(admin, user.id, "password_reset_by_admin", id);
        return NextResponse.json({ ok: true });
      }

      case "revoke_sessions": {
        if (id === user.id) {
          return NextResponse.json({ error: "You can't revoke your own sessions" }, { status: 400 });
        }
        // GoTrue exposes "log out everywhere" as POST /admin/users/{id}/logout;
        // supabase-js admin.signOut targets a single JWT instead, so call the
        // endpoint directly with the service key.
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}/logout`,
          {
            method: "POST",
            headers: {
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        if (!res.ok && res.status !== 404) {
          await logError("api:super-admin/users revoke_sessions", await res.text(), { id });
          return NextResponse.json({ error: "Could not revoke sessions" }, { status: 400 });
        }
        await audit(admin, user.id, "sessions_revoked", id);
        return NextResponse.json({ ok: true });
      }

      case "send_notification": {
        const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
        const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
        if (!title || !message) {
          return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
        }
        const { error } = await admin.from("notifications").insert({
          user_id: id,
          type: "system",
          title,
          message,
        });
        if (error) {
          await logError("api:super-admin/users send_notification", error.message, { id });
          return NextResponse.json({ error: "Could not send notification" }, { status: 400 });
        }
        await audit(admin, user.id, "notification_sent", id, { title });
        return NextResponse.json({ ok: true });
      }

      case "delete_account": {
        if (id === user.id) {
          return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
        }
        if (target.role === "super_admin") {
          return NextResponse.json(
            { error: "Demote other super admins before deleting them" },
            { status: 400 }
          );
        }
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) {
          await logError("api:super-admin/users delete_account", error.message, { id });
          return NextResponse.json({ error: "Could not delete account" }, { status: 400 });
        }
        await audit(admin, user.id, "account_deleted", id, { email: target.email });
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    await logError("api:super-admin/users", e, { id, action: (body as { action?: string }).action });
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
