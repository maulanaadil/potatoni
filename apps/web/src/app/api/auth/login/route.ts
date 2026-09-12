import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, HttpError, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";
import { loginInput } from "@/lib/validators";

export const POST = handler(async (request) => {
  const { email, password } = await parseBody(request, loginInput);
  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw new HttpError(401, "Wrong email or password");

  const session = { sub: user.id, name: user.name, email: user.email, role: user.role };
  const token = await signSession(session);
  await logActivity({
    action: "auth.login",
    message: `${user.name} signed in`,
    source: user.role === "ADMIN" ? "DASHBOARD" : "POS",
    session,
    entityType: "user",
    entityId: user.id,
  });

  const response = NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
});
