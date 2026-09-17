// Potatoni service worker. Live data (orders, prices, customers) is never cached: /api and
// page HTML always go to the network, so a shared stall device never shows stale or private data.
const STATIC_CACHE = "potatoni-static-v1";
const OFFLINE_CACHE = "potatoni-offline-v1";
const OFFLINE_URL = "/offline.html";
const MAX_STATIC_ENTRIES = 250;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== STATIC_CACHE && key !== OFFLINE_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES)).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const cache = await caches.open(STATIC_CACHE);
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    void trimStaticCache(cache);
  }
  return response;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkOrOffline(request));
    return;
  }
  // Content-hashed build output and app icons never change under the same URL.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

// Push notifications (Firebase Cloud Messaging). Messages are data-only, so the look of the
// notification is decided here and a device never shows two of them for one order.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {};
  }
  const data = payload.data ?? payload.notification ?? payload;
  if (!data.title && !data.body) return;

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Potatoni", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      vibrate: [70, 40, 70],
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
