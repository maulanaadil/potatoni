import { z } from "zod";

// Shapes shared by the assistant's API routes and the dashboard chat.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.enum(["pending", "done", "dismissed"]).default("pending");

export const purchaseProposalSchema = z.object({
  item: z.string(),
  quantity: z.number(),
  unit: z.string(),
  total: z.number(),
  supplier: z.string().nullish(),
  note: z.string().nullish(),
});

/** A form the assistant filled in; nothing is saved until the owner confirms it. */
export const assistantActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("purchases"),
    items: z.array(purchaseProposalSchema).min(1).max(20),
    purchased_on: day.nullish(),
    status,
  }),
  z.object({
    type: z.literal("location"),
    name: z.string(),
    address: z.string().nullish(),
    notes: z.string().nullish(),
    starts_on: day.nullish(),
    ends_on: day.nullish(),
    status,
  }),
]);

/** Unknown or malformed actions are dropped rather than breaking the chat. */
export const assistantActionsSchema = z.array(assistantActionSchema).max(5).catch([]);

export type PurchaseProposal = z.infer<typeof purchaseProposalSchema>;
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type ActionStatus = AssistantAction["status"];

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images: string[];
  tools: string[];
  actions: AssistantAction[];
  replies: string[];
};

export type AssistantChatSummary = { id: string; title: string; updatedAt: string; messageCount: number };

/** Keys produced by /api/admin/uploads with folder=assistant. */
export const ASSISTANT_IMAGE_KEY = /^assistant\/[\w-]+\.(png|jpg|webp)$/;
export const MAX_ASSISTANT_IMAGES = 3;
