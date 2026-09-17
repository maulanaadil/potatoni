"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/client";
import { deviceLabel, onPushMessage, pushSupported, requestPushToken } from "@/lib/firebase";

type State = "checking" | "unsupported" | "off" | "on" | "blocked" | "working";

/** Notifications the app receives while it's open; screens listen and refresh themselves. */
export const PUSH_EVENT = "potatoni:push";

export function PushAlerts() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let live = true;
    let stopListening = () => {};

    void (async () => {
      if (!(await pushSupported())) {
        if (live) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (live) setState("blocked");
        return;
      }
      if (Notification.permission === "granted") {
        // Tokens rotate; re-registering on load keeps this device reachable.
        const token = await requestPushToken().catch(() => null);
        if (token) await api("/api/push/devices", { body: { token, label: deviceLabel() } }).catch(() => {});
        if (live) setState(token ? "on" : "off");
      } else if (live) {
        setState("off");
      }

      stopListening = await onPushMessage((message) => {
        toast(message.title ?? "Potatoni", { description: message.body });
        window.dispatchEvent(new CustomEvent(PUSH_EVENT));
      });
    })();

    return () => {
      live = false;
      stopListening();
    };
  }, []);

  async function turnOn() {
    setState("working");
    try {
      const token = await requestPushToken();
      if (!token) {
        setState(Notification.permission === "denied" ? "blocked" : "off");
        return;
      }
      await api("/api/push/devices", { body: { token, label: deviceLabel() } });
      setState("on");
      toast.success("Notifications are on for this device");
    } catch (err) {
      setState("off");
      toast.error((err as Error).message);
    }
  }

  if (state === "checking" || state === "unsupported") return null;

  if (state === "on") {
    return (
      <span className="hidden items-center gap-1.5 rounded-full border-2 border-navy/15 px-3 py-1 text-xs font-bold text-navy-soft sm:inline-flex">
        <span aria-hidden>🔔</span> Alerts on
      </span>
    );
  }

  if (state === "blocked") {
    return (
      <span
        className="hidden text-xs font-bold text-navy-soft sm:inline"
        title="Allow notifications in your browser settings"
      >
        🔕 Alerts blocked
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={turnOn}
      disabled={state === "working"}
      className={buttonVariants({ intent: "outline", size: "sm" })}
    >
      {state === "working" ? "Turning on…" : "🔔 Turn on alerts"}
    </button>
  );
}
