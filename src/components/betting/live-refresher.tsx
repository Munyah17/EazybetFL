"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a live page's scores/odds current without a manual reload. Re-runs
 * the server component tree on an interval via router.refresh() -- this
 * project has no client data-fetching library, and the pages here already
 * source their data from Server Components (revalidate/force-dynamic), so
 * a refresh is enough to surface whatever the next sync cycle wrote.
 *
 * Pauses while the tab is hidden so backgrounded devices don't keep
 * spending battery/requests on a page nobody's looking at.
 */
export function LiveRefresher({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    if (document.visibilityState === "visible") start();
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
