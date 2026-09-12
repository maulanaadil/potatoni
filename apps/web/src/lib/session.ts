import { jwtVerify, SignJWT } from "jose";

// Edge-safe: imported by src/proxy.ts, so no Node-only deps here.

export const SESSION_COOKIE = "potatoni_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // a cashier device stays signed in for a month

export type Role = "ADMIN" | "CASHIER";
export type Session = { sub: string; name: string; email: string; role: Role };

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session) {
  return new SignJWT({ name: session.name, email: session.email, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role === "ADMIN" ? "ADMIN" : "CASHIER",
    };
  } catch {
    return null;
  }
}
