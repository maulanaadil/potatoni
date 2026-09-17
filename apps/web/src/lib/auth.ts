import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { type Role, SESSION_COOKIE, type Session, verifySession } from "./session";

/**
 * The raw JWT from `Authorization: Bearer` or the session cookie. Also forwarded to
 * internal services (apps/ai) so they can verify the caller themselves.
 */
export async function getSessionToken(): Promise<string | undefined> {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  return bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * Reads the JWT from the session cookie, or from `Authorization: Bearer`
 * so the same API works for non-browser clients.
 */
export async function getSession(): Promise<Session | null> {
  return verifySession(await getSessionToken());
}

/** For server components/pages: bounce to login when the role doesn't fit. */
export async function requirePageSession(role?: Role | Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  const allowed = role ? [role].flat() : null;
  if (allowed && !allowed.includes(session.role)) redirect(session.role === "KITCHEN" ? "/kitchen" : "/");
  return session;
}
