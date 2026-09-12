"use client";

import { useOffline } from "next/offline";
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // A worker left over from a production build would serve stale chunks to the dev server.
      void navigator.serviceWorker.getRegistrations().then((all) => {
        for (const registration of all) void registration.unregister();
      });
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }, []);
  return null;
}

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[70] flex animate-fade items-center justify-center gap-2 bg-navy px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 text-center text-xs font-bold text-cream print:hidden"
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-sun" />
      You're offline — pages and changes will retry as soon as the connection is back.
    </div>
  );
}
