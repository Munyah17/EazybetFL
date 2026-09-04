import "server-only";
import type { NextRequest } from "next/server";

/**
 * The app's public base URL, for building links we hand to external
 * services -- Paynow return/result URLs above all.
 *
 * Order of preference:
 *   1. NEXT_PUBLIC_APP_URL, if set to something real (not localhost)
 *   2. the host the current request actually arrived on -- in production
 *      this is always the real public domain, so it cannot be
 *      misconfigured the way an env var can
 *   3. VERCEL_PROJECT_PRODUCTION_URL (Vercel sets this automatically to the
 *      stable production domain -- never a preview URL)
 *
 * This exists because a wrong/absent NEXT_PUBLIC_APP_URL silently made the
 * Paynow `resulturl` point at localhost, so Paynow's server-to-server
 * payment confirmation never arrived and deposits only completed if the
 * user sat on the result page long enough for the browser poll to catch
 * it. Deriving from the request removes that failure mode entirely.
 */
export function getAppBaseUrl(req?: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const isLocal = (u: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(u);

  if (configured && !isLocal(configured)) return configured;

  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host && !isLocal(host)) {
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}`;
    }
  }

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd.replace(/\/+$/, "")}`;

  return configured ?? "http://localhost:3000";
}
