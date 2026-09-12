import type { Metadata } from "next";
import { AssistantChat } from "@/components/dashboard/assistant-chat";
import { requirePageSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const session = await requirePageSession("ADMIN");
  return <AssistantChat name={session.name} />;
}
