import type { VercelConfig } from "@vercel/config/v1";

// Cron-invoked routes are protected by CRON_SECRET (src/lib/cron-auth.ts) --
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
// invocations when an env var named exactly CRON_SECRET is set.
//
// Vercel's Hobby plan caps cron jobs at once/day each -- these schedules
// are staggered to fit that limit. That's a real functional tradeoff:
// /api/sync/scores driving bet settlement once a day is too slow for a
// live sportsbook. Until this project is on a Pro plan (unlimited cron
// frequency), point an external scheduler (e.g. cron-job.org, Upstash
// QStash -- both have free tiers) at /api/sync/scores every few minutes
// and /api/sync/odds hourly; the routes themselves have no rate limit,
// only Vercel's own cron trigger does.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    { path: "/api/sync/sports", schedule: "0 3 * * *" }, // daily at 03:00 UTC
    { path: "/api/sync/odds", schedule: "0 4 * * *" }, // daily at 04:00 UTC
    { path: "/api/sync/scores", schedule: "0 5 * * *" }, // daily at 05:00 UTC -- see note above
    { path: "/api/cron/expire-booked-bets", schedule: "0 6 * * *" }, // daily at 06:00 UTC
  ],
};
