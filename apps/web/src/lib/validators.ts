import { z } from "zod";

export const MAX_SEASONINGS = 2;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const loginInput = z.object({
  email: z.email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const orderItemInput = z.object({
  variantId: z.string().min(1),
  modifierIds: z.array(z.string().min(1)).max(12).default([]),
  quantity: z.number().int().min(1).max(50),
});

export const createOrderInput = z.object({
  items: z.array(orderItemInput).min(1, "The cart is empty").max(40),
  voucherCode: z.string().trim().toUpperCase().max(20).nullable().optional(),
  paymentMethod: z.enum(["QRIS", "CASH"]),
  // Omitted = today's scheduled location; null = explicitly none.
  locationId: z.string().min(1).nullable().optional(),
  customerName: optionalText(60),
  note: optionalText(200),
});

export const payOrderInput = z.object({
  paymentMethod: z.enum(["QRIS", "CASH"]),
  cashReceived: z.number().int().min(0).optional(),
});

export const orderStatusInput = z.object({
  status: z.enum(["PENDING", "PAID", "CANCELLED"]),
});

export const productInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  category: z.enum(["FRIES", "CHICKEN"]),
  tagline: optionalText(120),
  imageKey: optionalText(200),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  variants: z
    .array(
      z.object({
        size: z.string().trim().toUpperCase().min(1).max(4),
        grams: z.number().int().positive(),
        price: z.number().int().positive("Price must be greater than 0"),
        isPopular: z.boolean().default(false),
      }),
    )
    .min(1, "Add at least one size")
    .refine((v) => new Set(v.map((x) => x.size)).size === v.length, "Sizes must be unique"),
});

export const modifierInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.enum(["SEASONING", "ADDON", "UPGRADE"]),
  price: z.number().int().min(0),
  imageKey: optionalText(200),
  appliesTo: z.enum(["FRIES", "CHICKEN"]).nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const purchaseInput = z.object({
  item: z.string().trim().min(1, "Item is required").max(80),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().trim().min(1).max(16),
  total: z.number().int().positive("Total must be greater than 0"),
  supplier: optionalText(80),
  note: optionalText(200),
  purchasedAt: z.coerce.date().optional(),
  locationId: z.string().min(1).nullable().optional(),
});

export const userInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  email: z.email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role: z.enum(["ADMIN", "CASHIER"]),
});

export type CreateOrderInput = z.infer<typeof createOrderInput>;
export type ProductInput = z.infer<typeof productInput>;
export type ModifierInput = z.infer<typeof modifierInput>;
export type PurchaseInput = z.infer<typeof purchaseInput>;

const optionalDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .nullable()
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

export const locationInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    address: optionalText(160),
    notes: optionalText(300),
    startsOn: optionalDay,
    endsOn: optionalDay,
    isActive: z.boolean().default(true),
  })
  .refine((l) => !l.startsOn || !l.endsOn || l.endsOn >= l.startsOn, {
    message: "End date can't be before the start date",
    path: ["endsOn"],
  });

export type LocationInput = z.infer<typeof locationInput>;

/** Indonesian WhatsApp numbers: 0812…, 812…, 62812…, +62 812-… → +62812… */
export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return `+${digits}`;
}

const phoneInput = z
  .string()
  .trim()
  .min(1, "WhatsApp number is required")
  .transform(normalizePhone)
  .refine((p) => /^\+62\d{8,13}$/.test(p), "Enter a valid Indonesian WhatsApp number, e.g. 0812 3456 7890");

export const inviteInput = z.object({
  email: z.email("Invalid email address").trim().toLowerCase(),
  name: optionalText(60),
  role: z.enum(["ADMIN", "CASHIER"]),
});

export const acceptInviteInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const campaignInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    description: optionalText(300),
    discountType: z.enum(["PERCENT", "AMOUNT"]),
    discountValue: z.number().int().positive("Discount must be greater than 0"),
    maxDiscount: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    minSpend: z.number().int().min(0).default(0),
    claimStartsAt: optionalDay,
    claimEndsAt: optionalDay,
    validDays: z.number().int().min(1, "Vouchers must last at least a day").max(365),
    quota: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.discountType !== "PERCENT" || c.discountValue <= 100, {
    message: "A percentage discount can't be more than 100%",
    path: ["discountValue"],
  })
  .refine((c) => !c.claimStartsAt || !c.claimEndsAt || c.claimEndsAt >= c.claimStartsAt, {
    message: "Claiming can't end before it starts",
    path: ["claimEndsAt"],
  });

export const claimInput = z.object({
  name: z.string().trim().min(1, "Your name is required").max(60),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  phone: phoneInput,
  marketingConsent: z.boolean().default(false),
});

export const verifyClaimInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
});

export type CampaignInput = z.infer<typeof campaignInput>;

export const assistantInput = z.object({
  // Omitted/null = start a new chat.
  chatId: z.string().min(1).nullable().optional(),
  message: z.string().trim().min(1, "Ask something first").max(8000),
  imageKeys: z
    .array(z.string().regex(/^assistant\/[\w-]+\.(png|jpg|webp)$/, "Attach the image again"))
    .max(3, "Up to 3 images per question")
    .default([]),
});

export const assistantInstructionsInput = z.object({
  instructions: z.string().trim().min(20, "Write at least a sentence").max(20_000),
});

export const assistantActionInput = z.object({
  index: z.number().int().min(0).max(4),
  status: z.enum(["done", "dismissed"]),
});
