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
