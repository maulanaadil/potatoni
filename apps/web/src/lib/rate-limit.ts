import "server-only";
import { HttpError } from "./api";

// Per-process sliding window. Enough for one stall server; move to Redis if the app is
// ever scaled out to several instances. The per-claim limits in the database still hold.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // crude cap so the map can't grow forever
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
