import type { VercelConfig } from "@vercel/config/v1";

// Cron-invoked routes are protected by CRON_SECRET (src/lib/cron-auth.ts) --
// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
// invocations when an env var named exactly CRON_SECRET is set.
//
// Schedule is deliberately conservative: The Odds API free tier is capped
// at 500 requests/month, so /api/sync/odds (the expensive one -- pricing
// scales with markets x regions per sport) runs only 4x/day. /api/sync/scores
// runs more often since live scores matter for timely settlement and cost
// less per the API's own pricing model. Tune both once real usage/quota
// patterns are known.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    { path: "/api/sync/sports", schedule: "0 3 * * *" }, // daily at 03:00 UTC
    { path: "/api/sync/odds", schedule: "0 */6 * * *" }, // every 6 hours
    { path: "/api/sync/scores", schedule: "*/15 * * * *" }, // every 15 minutes
    { path: "/api/cron/expire-booked-bets", schedule: "0 4 * * *" }, // daily at 04:00 UTC
  ],
};
