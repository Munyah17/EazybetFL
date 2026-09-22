/**
 * Server-side aggregation helpers for the portal dashboard charts.
 * Pure functions over rows already fetched from Supabase -- no client
 * code, no extra queries.
 */

export type DailyPoint = { label: string; value: number };

/** Bucket rows into a per-day series over the last `days` days (oldest
 * first), summing `getValue` for rows whose `getDate` falls on each day.
 * Days with no rows are filled with 0 so the chart axis is continuous. */
export function dailySeries<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined,
  getValue: (row: T) => number,
  days = 30
): DailyPoint[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  const labels: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
    labels.push(key);
  }

  for (const row of rows) {
    const raw = getDate(row);
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + getValue(row));
    }
  }

  return labels.map((key) => ({
    label: new Date(key + "T00:00:00").toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    }),
    value: Math.round(buckets.get(key)! * 100) / 100,
  }));
}

export type StatusSlice = { name: string; value: number };

/** Count rows per status for a doughnut chart, ordered by count desc. */
export function statusBreakdown<T>(rows: T[], getStatus: (row: T) => string): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const s = getStatus(row) || "unknown";
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
