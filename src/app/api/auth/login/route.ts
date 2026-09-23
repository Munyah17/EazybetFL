import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

/** signInWithPassword moved server-side specifically so it can be rate
 * limited -- the Supabase browser client talks directly to Supabase's own
 * Auth API, which our backend never sees and can't throttle. Limited both
 * per-IP (blunt brute-force) and per-identifier (targeted account
 * brute-force from many IPs) -- either budget alone misses one of the two
 * attack shapes. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const allowedRoles: string[] | undefined = Array.isArray(body?.allowedRoles) ? body.allowedRoles : undefined;
  const deniedRoles: string[] | undefined = Array.isArray(body?.deniedRoles) ? body.deniedRoles : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ipLimited = await rateLimited(`login:ip:${ip}`, 20, 300);
  if (ipLimited) return ipLimited;
  const identifierLimited = await rateLimited(`login:id:${email.toLowerCase()}`, 8, 300);
  if (identifierLimited) return identifierLimited;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // "Invalid credentials" covers everything user-facing (never leak
    // which part was wrong, or whether the account exists). But a wrong
    // password and a broken Supabase connection (bad URL/anon key, project
    // unreachable) look identical to the end user while being completely
    // different problems -- log the real status/message/code so that
    // distinction is visible in the super-admin Logs page instead of
    // silently vanishing behind the generic copy.
    if (error) {
      await logError("api:auth/login", error.message, {
        status: error.status,
        code: (error as { code?: string }).code,
      });
    }
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Role check happens here, server-side, right after auth -- doing it
  // client-side afterward would need the browser client to notice a
  // cookie change made by this response before it could trust its own
  // session, which isn't guaranteed without an extra round trip. The
  // profile is fetched unconditionally because the staff backstop below
  // must hold even when a caller crafts a request with no role params.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  // Denied roles (e.g. staff on the public /login) get a generic 401, not
  // access_denied -- the public form must not reveal that the credentials
  // were valid or that the account is privileged. The attempt is logged so
  // it shows up on the System Status page.
  if (profile && deniedRoles?.includes(profile.role)) {
    await supabase.auth.signOut();
    await logError("api:auth/login", "Denied-role login attempt rejected", {
      role: profile.role,
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  }

  // Staff backstop: admin and super_admin accounts are offices, not wager
  // profiles -- they may only ever authenticate through a portal login that
  // explicitly allows their role. Any other request (public /login, or a
  // crafted body with no role params) is rejected with a generic 401.
  const isStaff = profile?.role === "admin" || profile?.role === "super_admin";
  if (isStaff && !allowedRoles?.includes(profile!.role)) {
    await supabase.auth.signOut();
    await logError("api:auth/login", "Staff login outside portal rejected", {
      role: profile!.role,
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
