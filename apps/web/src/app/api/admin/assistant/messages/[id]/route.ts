import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { setAssistantActionStatus } from "@/lib/services/assistant";
import { assistantActionInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const { index, status } = await parseBody(request, assistantActionInput);
  return NextResponse.json(await setAssistantActionStatus(session.sub, id, index, status));
});
