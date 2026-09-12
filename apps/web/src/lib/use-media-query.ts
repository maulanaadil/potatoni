"use client";

import { useSyncExternalStore } from "react";

/**
 * Live `matchMedia` result. The server snapshot is `false`, so anything that branches on
 * this should be closed on first render (dialogs are) to avoid a hydration flash.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
