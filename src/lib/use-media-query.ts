"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook. Returns false on the server and on first
 * client render (matching the server output to avoid hydration
 * mismatches), then updates after mount. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Subscribing to an external system (the browser's media query list) --
    // exactly what effects are for, not a plain state mirror.
    const mql = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

export const DESKTOP_QUERY = "(min-width: 1024px)";
