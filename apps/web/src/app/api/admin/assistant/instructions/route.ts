import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { getAssistantInstructions, saveAssistantInstructions } from "@/lib/services/assistant";
import { assistantInstructionsInput } from "@/lib/validators";

export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  return NextResponse.json(await getAssistantInstructions());
});

export const PUT = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const { instructions } = await parseBody(request, assistantInstructionsInput);
  return NextResponse.json(await saveAssistantInstructions(instructions, session));
});

export const DELETE = handler(async () => {
  const session = await requireApiSession("ADMIN");
  return NextResponse.json(await saveAssistantInstructions(null, session));
});
