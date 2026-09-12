import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { appUrl } from "@/lib/email";
import { resendInvite } from "@/lib/services/invites";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  return NextResponse.json(await resendInvite(id, session, appUrl(request)));
});
