import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { listAssistantChats } from "@/lib/services/assistant";

export const GET = handler(async () => {
  const session = await requireApiSession("ADMIN");
  return NextResponse.json({ chats: await listAssistantChats(session.sub) });
});
