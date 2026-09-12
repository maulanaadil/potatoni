import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { deleteAssistantChat, getAssistantChat } from "@/lib/services/assistant";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  return NextResponse.json(await getAssistantChat(session.sub, id));
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  await deleteAssistantChat(session.sub, id);
  return NextResponse.json({ ok: true });
});
