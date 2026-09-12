import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";
import { askAssistant } from "@/lib/services/assistant";
import { assistantInput } from "@/lib/validators";

export const maxDuration = 300;

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const { chatId, message, imageKeys } = await parseBody(request, assistantInput);
  const token = (await getSessionToken()) ?? "";
  return NextResponse.json(
    await askAssistant({ userId: session.sub, token, chatId: chatId ?? null, message, imageKeys }),
  );
});
