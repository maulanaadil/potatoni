import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { acceptInvite } from "@/lib/services/invites";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";
import { acceptInviteInput } from "@/lib/validators";

type Ctx = { params: Promise<{ token: string }> };

// Public: the invitee isn't signed in yet. Accepting creates the account and signs them in.
export const POST = handler(async (request, { params }: Ctx) => {
  rateLimit(`invite:${clientIp(request)}`, 10, 10 * 60_000);
  const { token } = await params;
  const input = await parseBody(request, acceptInviteInput);
  const session = await acceptInvite(token, input);

  const response = NextResponse.json({ user: { name: session.name, role: session.role } }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
});
