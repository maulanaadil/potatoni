import "server-only";
import type { AssistantRole, Prisma } from "@/generated/prisma/client";
import { HttpError } from "../api";
import {
  type AssistantAction,
  type AssistantChatSummary,
  type AssistantMessage,
  assistantActionsSchema,
} from "../assistant-types";
import { db } from "../db";
import { getObject } from "../s3";

// Answers can take several tool rounds plus a web search (~1.5 min for the long ones).
const TIMEOUT_MS = 180_000;
// The assistant service accepts up to 40 messages per question.
const MAX_HISTORY = 40;

const role = (r: AssistantRole) => (r === "USER" ? ("user" as const) : ("assistant" as const));

type MessageRow = {
  id: string;
  role: AssistantRole;
  content: string;
  images: string[];
  tools: string[];
  actions: Prisma.JsonValue;
  replies: string[];
};

const toView = (m: MessageRow): AssistantMessage => ({
  id: m.id,
  role: role(m.role),
  content: m.content,
  images: m.images,
  tools: m.tools,
  actions: assistantActionsSchema.parse(m.actions ?? []),
  replies: m.replies,
});

const asJson = (actions: AssistantAction[]) => actions as unknown as Prisma.InputJsonValue;

/**
 * What an earlier answer proposed (the form itself isn't part of the text), so a follow-up like
 * "the oil should be after the discount" corrects the real numbers instead of starting over.
 */
function proposalNote(actions: AssistantAction[]) {
  return actions
    .map((a) =>
      a.type === "purchases"
        ? `[Proposed purchases (${a.status}), dated ${a.purchased_on ?? "today"}: ${a.items
            .map((i) => `${i.item} ${i.quantity} ${i.unit} Rp ${i.total}${i.supplier ? ` from ${i.supplier}` : ""}`)
            .join("; ")}]`
        : `[Proposed location (${a.status}): ${[
            a.name,
            a.address,
            a.starts_on && `${a.starts_on} to ${a.ends_on ?? "?"}`,
            a.notes,
          ]
            .filter(Boolean)
            .join(", ")}]`,
    )
    .join("\n");
}

/** "What's our next bazaar in Bandung, and how should…" — the first line of the first question. */
function chatTitle(message: string) {
  const line = message.trim().split("\n")[0] ?? "";
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

export async function listAssistantChats(userId: string): Promise<AssistantChatSummary[]> {
  const chats = await db.assistantChat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return chats.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c._count.messages,
  }));
}

export async function getAssistantChat(userId: string, chatId: string) {
  const chat = await db.assistantChat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!chat) throw new HttpError(404, "That chat no longer exists");
  return { id: chat.id, title: chat.title, messages: chat.messages.map(toView) };
}

export async function deleteAssistantChat(userId: string, chatId: string) {
  const { count } = await db.assistantChat.deleteMany({ where: { id: chatId, userId } });
  if (!count) throw new HttpError(404, "That chat no longer exists");
}

/** Marks a proposed purchase/location as recorded or dismissed, so the chat history shows it. */
export async function setAssistantActionStatus(
  userId: string,
  messageId: string,
  index: number,
  status: "done" | "dismissed",
) {
  const message = await db.assistantMessage.findFirst({
    where: { id: messageId, chat: { userId } },
    select: { actions: true },
  });
  const actions = assistantActionsSchema.parse(message?.actions ?? []);
  const action = actions[index];
  if (!message || !action) throw new HttpError(404, "That suggestion no longer exists");
  actions[index] = { ...action, status };
  await db.assistantMessage.update({ where: { id: messageId }, data: { actions: asJson(actions) } });
  return { actions };
}

async function loadImage(key: string) {
  const object = await getObject(key).catch(() => null);
  const bytes = await object?.Body?.transformToByteArray();
  if (!bytes) throw new HttpError(400, "An attached image couldn't be read — attach it again");
  const ext = key.split(".").pop();
  const media_type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { media_type, data: Buffer.from(bytes).toString("base64") };
}

/**
 * Sends the question (with its images) and the chat's saved history to the assistant service
 * (apps/ai), which re-checks the JWT. Both turns are saved only once the answer arrives, so a
 * failed question never clutters the history, and an answer still lands if the browser closed.
 */
export async function askAssistant({
  userId,
  token,
  chatId,
  message,
  imageKeys,
}: {
  userId: string;
  token: string;
  chatId: string | null;
  message: string;
  imageKeys: string[];
}) {
  const chat = chatId
    ? await db.assistantChat.findFirst({
        where: { id: chatId, userId },
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true, images: true, actions: true },
          },
        },
      })
    : null;
  if (chatId && !chat) throw new HttpError(404, "That chat no longer exists");

  // Earlier images aren't re-sent (tokens); the model only learns that one was there.
  let history = [
    ...(chat?.messages ?? []).map((m) => ({
      role: role(m.role),
      content: [
        m.content,
        m.images.length ? "[An image was attached here earlier.]" : "",
        proposalNote(assistantActionsSchema.parse(m.actions ?? [])),
      ]
        .filter(Boolean)
        .join("\n\n"),
    })),
    { role: "user" as const, content: message, images: await Promise.all(imageKeys.map(loadImage)) },
  ].slice(-MAX_HISTORY);
  // Claude needs the conversation to open with a question.
  while (history[0]?.role === "assistant") history = history.slice(1);

  const askedAt = new Date();
  const res = await fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:4000"}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: history }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new HttpError(504, "The assistant took too long to answer — please try again");
    }
    throw new HttpError(503, "The assistant service isn't running (apps/ai)");
  });

  const data = (await res.json().catch(() => ({}))) as {
    reply?: string;
    tools?: string[];
    actions?: unknown;
    replies?: string[];
    error?: string;
  };
  const reply = data.reply;
  if (!res.ok || !reply) {
    throw new HttpError(res.ok ? 502 : res.status, data.error ?? "The assistant sent an invalid answer");
  }
  const actions = assistantActionsSchema.parse(data.actions ?? []);

  return db.$transaction(async (tx) => {
    const target =
      chat ?? (await tx.assistantChat.create({ data: { userId, title: chatTitle(message) }, select: { id: true } }));
    const question = await tx.assistantMessage.create({
      data: { chatId: target.id, role: "USER", content: message, images: imageKeys, createdAt: askedAt },
    });
    const answer = await tx.assistantMessage.create({
      data: {
        chatId: target.id,
        role: "ASSISTANT",
        content: reply,
        tools: data.tools ?? [],
        actions: actions.length ? asJson(actions) : undefined,
        replies: (data.replies ?? []).slice(0, 3),
      },
    });
    // Moves the chat to the top of the history list.
    await tx.assistantChat.update({ where: { id: target.id }, data: { updatedAt: new Date() } });
    return { chatId: target.id, messages: [toView(question), toView(answer)] };
  });
}
