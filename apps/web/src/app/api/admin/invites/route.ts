import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { appUrl } from "@/lib/email";
import { createInvite, listOpenInvites } from "@/lib/services/invites";
import { inviteInput } from "@/lib/validators";

export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  return NextResponse.json({ invites: await listOpenInvites() });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const input = await parseBody(request, inviteInput);
  const { invite, delivered, devLink } = await createInvite(input, session, appUrl(request));
  return NextResponse.json({ invite: { id: invite.id, email: invite.email }, delivered, devLink }, { status: 201 });
});
