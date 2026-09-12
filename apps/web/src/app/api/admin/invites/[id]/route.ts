import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { revokeInvite } from "@/lib/services/invites";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  await revokeInvite(id, session);
  return NextResponse.json({ ok: true });
});
