import type { Metadata } from "next";
import { AssistantInstructions } from "@/components/dashboard/assistant-instructions";
import { getSessionToken, requirePageSession } from "@/lib/auth";
import { getAssistantInstructions, getAssistantRules } from "@/lib/services/assistant";

export const metadata: Metadata = { title: "Assistant instructions" };

export default async function AssistantInstructionsPage() {
  await requirePageSession("ADMIN");
  const [settings, rules] = await Promise.all([
    getAssistantInstructions(),
    getAssistantRules((await getSessionToken()) ?? ""),
  ]);
  return <AssistantInstructions initial={settings} rules={rules} />;
}
