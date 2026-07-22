export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // This sandbox's network blackholes IPv6, but Node's undici (used by
    // fetch) tries IPv6 first and eats a ~10s connect timeout before
    // falling back. Force IPv4 first so outbound calls (Odds API, Paynow,
    // EcoCash, Supabase Management API) resolve immediately.
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
