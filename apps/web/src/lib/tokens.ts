import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Opaque link token (invites). Only its sha256 is stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** 6-digit email code, HMAC'd with the claim id so a leaked hash can't be replayed elsewhere. */
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hashOtp = (claimId: string, otp: string) =>
  createHmac("sha256", process.env.JWT_SECRET!).update(`${claimId}:${otp}`).digest("hex");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// No 0/O/1/I so codes survive being read out loud at a busy stall.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const pick = (n: number, alphabet = CODE_ALPHABET) =>
  Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("");

export const newVoucherCode = () => `PTN-${pick(6)}`;
export const newSlug = () => pick(8, "abcdefghjkmnpqrstuvwxyz23456789");
