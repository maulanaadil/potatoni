import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Role, type Session } from "./session";

/**
 * Reads the JWT from the session cookie, or from `Authorization: Bearer`
 * so the same API works for non-browser clients.
 */
export async function getSession(): Promise<Session | null> {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const token = bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** For server components/pages: bounce to login when the role doesn't fit. */
export async function requirePageSession(role?: Role) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (role === "ADMIN" && session.role !== "ADMIN") redirect("/");
  return session;
}
