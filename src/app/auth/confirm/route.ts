import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

// OTP types we accept from an emailed link -- anything else isn't ours.
const VALID_TYPES: EmailOtpType[] = ["signup", "recovery", "invite", "magiclink", "email_change", "email"];

/** Landing target for emailed auth links (signup confirmation, password
 * recovery). GoTrue verifies the token, then redirects the browser to the
 * `redirect_to` we passed with ?token_hash=..&type=.. (or a PKCE ?code=..
 * when the flow was started client-side). Exchanging it here, on the
 * server, matters because the browser that opens the email frequently
 * isn't the one that requested it (mail app webview, different device) --
 * there may be no PKCE verifier cookie, but a token_hash always works. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  // Open-redirect guard: only same-origin absolute paths.
  const nextParam = params.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();

  let error: { message: string } | null = null;
  if (tokenHash && type) {
    if (!VALID_TYPES.includes(type)) {
      error = { message: `unexpected otp type "${type}"` };
    } else {
      ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
    }
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: "missing token_hash/type and code" };
  }

  if (error) {
    // Same reason as /api/auth/*: an expired or replayed link looks
    // identical to a config break without a persisted log line.
    await logError("auth:confirm", error.message, {
      type: type ?? undefined,
      hadTokenHash: Boolean(tokenHash),
      hadCode: Boolean(code),
    });
    return NextResponse.redirect(new URL("/login?error=auth-link", req.nextUrl.origin));
  }

  return NextResponse.redirect(new URL(next, req.nextUrl.origin));
}
