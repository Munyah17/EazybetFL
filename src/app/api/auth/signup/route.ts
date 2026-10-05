import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { normalizeZwPhone } from "@/lib/phone";
import { getAppBaseUrl } from "@/lib/app-url";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

/** signUp moved server-side for the same reason as /api/auth/login --
 * only per-IP here (no existing identifier to key on yet, and signup is
 * inherently self-limiting once an email is taken). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const rawPhone = typeof body?.phone === "string" ? body.phone : null;

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Authoritative normalization -- never trust the client's formatting.
  // A phone that was supplied but can't be parsed is rejected rather than
  // stored malformed (which is what broke phone login before).
  let phone: string | null = null;
  if (rawPhone && rawPhone.trim()) {
    phone = normalizeZwPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid Zimbabwe mobile number, e.g. 0771234567" }, { status: 400 });
    }
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const ip = clientIp(req);
  const limited = await rateLimited(`signup:ip:${ip}`, 10, 3600);
  if (limited) return limited;

  const supabase = await createClient();

  // profiles.phone is UNIQUE, so a number already on another account fails
  // deep inside the handle_new_user trigger -- GoTrue reports only
  // "Database error saving new user", the auth row is rolled back, and the
  // user gets an unexplained "try again" that can never succeed (the exact
  // case of a test/demo account squatting a real person's number). Ask the
  // lookup function first so the response names the actual problem.
  if (phone) {
    const { data: phoneTakenBy } = await supabase.rpc("fn_lookup_email_by_phone", {
      p_phone: phone,
    });
    if (phoneTakenBy) {
      return NextResponse.json(
        { error: "That phone number is already linked to an account. Try signing in with it instead." },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    // Without emailRedirectTo GoTrue falls back to the project's Site URL --
    // which was localhost, so confirmation links opened a dead page and new
    // accounts could never confirm. getAppBaseUrl(req) derives the host
    // from this request, so a misconfigured NEXT_PUBLIC_APP_URL can't put
    // localhost into the email again. /auth/confirm must be allowlisted in
    // Supabase Auth -> URL Configuration -> Redirect URLs.
    options: {
      data: { full_name: fullName, phone },
      emailRedirectTo: `${getAppBaseUrl(req)}/auth/confirm`,
    },
  });
  if (error) {
    // Keep raw Supabase/GoTrue text out of the client (it leaks internals and
    // reads like noise) -- translate the failures we know, log everything to
    // system_logs so a real breakage is diagnosable on System Status.
    const msg = error.message;
    await logError("api:auth/signup", msg, { email });
    let friendly: string;
    if (/already (been )?registered|already exists|already in use/i.test(msg)) {
      friendly = "An account with this email already exists. Try signing in instead.";
    } else if (/rate limit/i.test(msg)) {
      friendly = "Too many attempts. Please wait a moment and try again.";
    } else if (/password/i.test(msg)) {
      friendly = "That password doesn't meet the requirements. Use at least 8 characters.";
    } else if (/email.*(invalid|not.*valid)|invalid.*email/i.test(msg)) {
      friendly = "That email address doesn't look right. Please check it.";
    } else if (/signups? (not|are not) allowed|disabled/i.test(msg)) {
      friendly = "New sign-ups are currently disabled.";
    } else {
      friendly = "We couldn't create your account right now. Please try again.";
    }
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
