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
  paymentMethod: z.enum(["QRIS", "CASH"]),
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
