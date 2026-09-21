import { after, NextRequest, NextResponse } from "next/server";
import { logWarn } from "@/lib/log";

export function requireCronSecret(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // A rejected cron call used to leave no trace anywhere -- the scheduler
    // only sees a 401 and our own system_logs stayed empty, so a mistyped
    // CRON_SECRET (or Vercel Deployment Protection intercepting the request)
    // silently disabled every scheduled job. Log it after the response so
    // the rejection is visible on the super admin System Status page.
    const path = req.nextUrl.pathname;
    const hasSecret = Boolean(process.env.CRON_SECRET);
    const hasAuthHeader = Boolean(auth);
    after(() =>
      logWarn("cron:auth", `rejected ${path} (HTTP 401)`, {
        path,
        cronSecretConfigured: hasSecret,
        authorizationHeaderPresent: hasAuthHeader,
      })
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
