import { jwtVerify } from "jose";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";

const secret = new TextEncoder().encode(env.jwtSecret);

/**
 * Same session JWT as the web app (apps/web/src/lib/session.ts), forwarded as
 * `Authorization: Bearer`. The assistant sees the whole business, so owners only.
 */
export async function requireAdmin(authorization: string | undefined) {
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Please sign in first");

  const payload = await jwtVerify(token, secret, { algorithms: ["HS256"] }).then(
    (r) => r.payload,
    () => null,
  );
  if (!payload?.sub) throw new HttpError(401, "Please sign in first");
  if (payload.role !== "ADMIN") throw new HttpError(403, "Admins only");
  return { id: payload.sub, name: String(payload.name), email: String(payload.email) };
}
