import "server-only";
import type { AssistantRole, Prisma } from "@/generated/prisma/client";
import { logActivity } from "../activity";
import { HttpError } from "../api";
import { type AssistantInstructionsView, DEFAULT_ASSISTANT_INSTRUCTIONS } from "../assistant-instructions";
import {
  type AssistantAction,
  type AssistantChatSummary,
  type AssistantMessage,
  assistantActionsSchema,
} from "../assistant-types";
import { db } from "../db";
import { getObject } from "../s3";
import type { Session } from "../session";

const TIMEOUT_MS = 180_000;
const MAX_HISTORY = 40;
const SETTINGS_ID = "default";
// Vercel functions accept request bodies up to 4.5 MB; leave room for the text history.
const MAX_IMAGE_PAYLOAD = 3_800_000;

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

/** Earlier forms aren't part of the answer text; without this a follow-up correction starts from scratch. */
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

function chatTitle(message: string) {
  const line = message.trim().split("\n")[0] ?? "";
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

async function callAssistantService(path: string, token: string, body?: unknown) {
  const res = await fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:4000"}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err: unknown) => {
    throw err instanceof Error && err.name === "TimeoutError"
      ? new HttpError(504, "The assistant took too long to answer — please try again")
      : new HttpError(503, "The assistant service isn't running (apps/ai)");
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new HttpError(res.status, typeof data.error === "string" ? data.error : "The assistant service failed");
  }
  return data;
}

export async function getAssistantInstructions(): Promise<AssistantInstructionsView> {
  const settings = await db.assistantSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    instructions: settings?.instructions ?? DEFAULT_ASSISTANT_INSTRUCTIONS,
    isDefault: !settings,
    updatedAt: settings?.updatedAt.toISOString() ?? null,
    updatedBy: settings?.updatedBy ?? null,
  };
}

/** Saves the instructions, or goes back to the default when `instructions` is null. */
export async function saveAssistantInstructions(instructions: string | null, session: Session) {
  if (instructions === null) {
    await db.assistantSettings.deleteMany({ where: { id: SETTINGS_ID } });
  } else {
    await db.assistantSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, instructions, updatedBy: session.name },
      update: { instructions, updatedBy: session.name },
    });
  }
  await logActivity({
    action: instructions === null ? "assistant.instructions_reset" : "assistant.instructions_updated",
    message: `${session.name} ${instructions === null ? "reset" : "updated"} the assistant's instructions`,
    source: "DASHBOARD",
    session,
  });
  return getAssistantInstructions();
}

/** The fixed rules apps/ai appends to the instructions; null when the service is down. */
export async function getAssistantRules(token: string) {
  const data = await callAssistantService("/rules", token).catch(() => null);
  return typeof data?.rules === "string" ? data.rules : null;
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
 * Asks apps/ai with the chat's saved history and the team's instructions. Both turns are saved
 * only once the answer arrives, so failed questions never clutter the history.
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

  const images = await Promise.all(imageKeys.map(loadImage));
  if (images.reduce((size, image) => size + image.data.length, 0) > MAX_IMAGE_PAYLOAD) {
    throw new HttpError(413, "Those photos are too big together — send one or two at a time");
  }

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
    { role: "user" as const, content: message, images },
  ].slice(-MAX_HISTORY);
  while (history[0]?.role === "assistant") history = history.slice(1);

  const askedAt = new Date();
  const { instructions } = await getAssistantInstructions();
  const data = await callAssistantService("/chat", token, { messages: history, instructions });
  const reply = typeof data.reply === "string" ? data.reply : "";
  if (!reply) throw new HttpError(502, "The assistant sent an invalid answer");
  const actions = assistantActionsSchema.parse(data.actions ?? []);
  const tools = Array.isArray(data.tools) ? data.tools.map(String) : [];
  const replies = Array.isArray(data.replies) ? data.replies.map(String).slice(0, 3) : [];

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
        tools,
        actions: actions.length ? asJson(actions) : undefined,
        replies,
      },
    });
    await tx.assistantChat.update({ where: { id: target.id }, data: { updatedAt: new Date() } });
    return { chatId: target.id, messages: [toView(question), toView(answer)] };
  });
}
