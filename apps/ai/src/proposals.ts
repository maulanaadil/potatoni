import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { inputSchema } from "./tools.ts";

// Proposal tools: the assistant can't save anything (its database access is read-only), but it
// can fill in a form that the dashboard shows under the answer. Nothing is saved until the
// owner reviews it and presses Record / Add. suggest_replies turns into tappable follow-ups.

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const text = (max: number) => z.string().trim().max(max);

const purchasesArgs = z.object({
  items: z
    .array(
      z.object({
        item: text(80).min(1).describe("What was bought, as the stall calls it, e.g. 'Minyak Goreng' or 'Shoestring'"),
        quantity: z.number().positive().describe("Amount in `unit`, e.g. 5"),
        unit: text(16).min(1).describe("kg, gr, ltr, pcs, pck, …"),
        total: z.number().int().positive().describe("Rupiah actually paid for this line, after discounts"),
        supplier: text(80).optional().describe("Shop or seller, e.g. 'Shopee - Granology' or 'Pasar'"),
        note: text(200).optional(),
      }),
    )
    .min(1)
    .max(20),
  purchased_on: dayKey.optional().describe("Date on the receipt (YYYY-MM-DD). Omit when it isn't shown."),
});

const locationArgs = z.object({
  name: text(80).min(1).describe("Event or spot name, e.g. 'Pensi SMA 3 Bandung'"),
  address: text(160).optional(),
  notes: text(300).optional().describe("Organiser, contact, booth fee, opening hours…"),
  starts_on: dayKey.optional(),
  ends_on: dayKey.optional(),
});

const repliesArgs = z.object({
  replies: z
    .array(text(80).min(2))
    .min(1)
    .max(3)
    .describe("Short follow-up questions the owner might tap next, in their language"),
});

export type Action =
  | ({ type: "purchases" } & z.infer<typeof purchasesArgs>)
  | ({ type: "location" } & z.infer<typeof locationArgs>);

export const proposalTools: Anthropic.Beta.BetaTool[] = [
  {
    name: "propose_purchases",
    description:
      "Fill in stock purchases for the owner to review and confirm — use it when an image (receipt, invoice, marketplace order, supplier chat) or a message shows stock that was bought. One line per item. Nothing is saved until the owner presses Record.",
    input_schema: inputSchema(purchasesArgs),
  },
  {
    name: "propose_location",
    description:
      "Fill in a new selling location/event for the owner to review and confirm — use it when an image (event poster, invitation, tenant call) or a message describes a bazaar or spot to sell at. Nothing is saved until the owner presses Add.",
    input_schema: inputSchema(locationArgs),
  },
  {
    name: "suggest_replies",
    description: "Offer 2–3 short follow-up questions shown as buttons under your answer. Call it last.",
    input_schema: inputSchema(repliesArgs),
  },
];

export const isProposal = (name: string) => proposalTools.some((t) => t.name === name);

/** Validates a proposal call; the error goes back to the model so it can fix the arguments. */
export function readProposal(
  name: string,
  input: unknown,
): { action?: Action; replies?: string[] } | { error: string } {
  const fail = (err: z.ZodError) => ({ error: `Invalid arguments: ${err.issues[0]?.message}` });
  if (name === "propose_purchases") {
    const parsed = purchasesArgs.safeParse(input);
    return parsed.success ? { action: { type: "purchases", ...parsed.data } } : fail(parsed.error);
  }
  if (name === "propose_location") {
    const parsed = locationArgs.safeParse(input);
    return parsed.success ? { action: { type: "location", ...parsed.data } } : fail(parsed.error);
  }
  const parsed = repliesArgs.safeParse(input);
  return parsed.success ? { replies: parsed.data.replies } : fail(parsed.error);
}
