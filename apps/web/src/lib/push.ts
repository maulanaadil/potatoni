import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { db } from "./db";
import type { Role } from "./session";

export type PushPayload = { title: string; body: string; url: string; tag: string };

function credentials() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores the key with literal \n.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/** Null when Firebase isn't configured, so the app runs fine without notifications. */
function messaging() {
  const creds = credentials();
  if (!creds) return null;
  const app = getApps()[0] ?? initializeApp({ credential: cert(creds) }, "potatoni-push");
  return getMessaging(app);
}

export const pushConfigured = () => credentials() !== null;

const isDeadToken = (error?: { code?: string }) =>
  error?.code === "messaging/registration-token-not-registered" || error?.code === "messaging/invalid-argument";

/**
 * Data-only messages: public/sw.js decides how the notification looks, so a device
 * never shows a duplicate of what the SDK would draw by itself.
 */
export async function sendToRoles(roles: Role[], payload: PushPayload) {
  const fcm = messaging();
  if (!fcm) return 0;

  const devices = await db.pushDevice.findMany({
    where: { user: { role: { in: roles } } },
    select: { id: true, token: true },
  });
  if (devices.length === 0) return 0;

  const result = await fcm.sendEachForMulticast({
    tokens: devices.map((d) => d.token),
    data: { ...payload },
    webpush: { headers: { Urgency: "high", TTL: "900" } },
    android: { priority: "high" },
  });

  const gone = devices.flatMap((device, i) => {
    const response = result.responses[i];
    return response && !response.success && isDeadToken(response.error) ? [device.id] : [];
  });
  if (gone.length > 0) await db.pushDevice.deleteMany({ where: { id: { in: gone } } });
  return result.successCount;
}
