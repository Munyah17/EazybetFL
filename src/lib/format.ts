export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatOdds(odds: number) {
  return odds.toFixed(2);
}

// Pinned to Zimbabwe's timezone rather than the runtime's local zone: without
// this, the server (Vercel, UTC) and the client (a CAT/UTC+2 browser) render
// different text for the same instant, which is a React hydration mismatch
// (error #418) on every page listing fixtures. Fixed offset year-round --
// Africa/Harare doesn't observe DST -- so this also can't drift out of sync
// with itself between SSR and hydration.
const DISPLAY_TZ = "Africa/Harare";

export function formatKickoff(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ }) ===
    today.toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: DISPLAY_TZ });
  if (isToday) return time;
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: DISPLAY_TZ }) + " " + time
  );
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
