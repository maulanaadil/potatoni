// The SDK is only pulled in when a device actually turns notifications on, so the
// register and dashboard bundles stay small.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export type PushMessage = { title?: string; body?: string; url?: string; tag?: string };

/** False when Firebase isn't configured or the browser can't do web push (e.g. iOS Safari tabs). */
export async function pushSupported() {
  if (!config.apiKey || !vapidKey) return false;
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  const { isSupported } = await import("firebase/messaging");
  return isSupported().catch(() => false);
}

async function messaging() {
  const [{ getApps, initializeApp }, { getMessaging }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  return getMessaging(getApps()[0] ?? initializeApp(config));
}

/**
 * Asks for permission if needed and returns this device's token. It reuses the app's own
 * service worker, so only one worker ever controls the page.
 */
export async function requestPushToken() {
  if (!(await pushSupported())) return null;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return null;

  const { getToken } = await import("firebase/messaging");
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  return getToken(await messaging(), { vapidKey, serviceWorkerRegistration });
}

/** Messages that arrive while the app is on screen: the OS stays quiet, so we show them. */
export async function onPushMessage(listener: (message: PushMessage) => void) {
  if (!(await pushSupported())) return () => {};
  const { onMessage } = await import("firebase/messaging");
  return onMessage(await messaging(), (payload) => listener({ ...payload.notification, ...payload.data }));
}

export const deviceLabel = () => {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : "Desktop";
  const browser = /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : "Safari";
  const installed = window.matchMedia("(display-mode: standalone)").matches ? " · installed" : "";
  return `${os} · ${browser}${installed}`;
};
