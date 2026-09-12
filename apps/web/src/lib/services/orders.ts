import "server-only";
import { Prisma, type PaymentMethod } from "@/generated/prisma/client";
import { logActivity } from "../activity";
import { HttpError } from "../api";
import { db } from "../db";
import { formatRupiah, jakartaDateKey, startOfJakartaDay } from "../format";
import { resolveLocationId } from "./locations";
import type { Session } from "../session";
import { MAX_SEASONINGS, type CreateOrderInput } from "../validators";

export const orderInclude = {
  items: { orderBy: { id: "asc" } },
  location: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;
export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type ModifierSnapshot = { id: string; name: string; type: string; price: number };

async function nextOrderCode(tx: Pick<typeof db, "order">) {
  const count = await tx.order.count({ where: { createdAt: { gte: startOfJakartaDay() } } });
  const day = jakartaDateKey().slice(2).replaceAll("-", "");
  return `PTN-${day}-${String(count + 1).padStart(3, "0")}`;
}

/** Prices are always recomputed from the database — the client only sends ids. */
async function priceItems(items: CreateOrderInput["items"]) {
  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const modifierIds = [...new Set(items.flatMap((i) => i.modifierIds))];

  const [variants, modifiers] = await Promise.all([
    db.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true } }),
    db.modifier.findMany({ where: { id: { in: modifierIds }, isActive: true } }),
  ]);
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const modifierById = new Map(modifiers.map((m) => [m.id, m]));

  return items.map((item) => {
    const variant = variantById.get(item.variantId);
    if (!variant || !variant.product.isActive) {
      throw new HttpError(400, "An item in the cart is no longer available");
    }
    const chosen = [...new Set(item.modifierIds)].map((id) => {
      const modifier = modifierById.get(id);
      if (!modifier) throw new HttpError(400, "An add-on in the cart is no longer available");
      if (modifier.appliesTo && modifier.appliesTo !== variant.product.category) {
        throw new HttpError(400, `${modifier.name} can't be added to ${variant.product.name}`);
      }
      return modifier;
    });
    if (chosen.filter((m) => m.type === "SEASONING").length > MAX_SEASONINGS) {
      throw new HttpError(400, `Pick at most ${MAX_SEASONINGS} free seasonings`);
    }
    if (chosen.filter((m) => m.type === "UPGRADE").length > 1) {
      throw new HttpError(400, "Pick only one cut");
    }

    const snapshots: ModifierSnapshot[] = chosen.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      price: m.price,
    }));
    const unitPrice = variant.price + chosen.reduce((sum, m) => sum + m.price, 0);
    return {
      productId: variant.productId,
      productName: variant.product.name,
      variantSize: variant.size,
      variantGrams: variant.grams,
      modifiers: snapshots,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
    };
  });
}

export async function createOrder(input: CreateOrderInput, session: Session) {
  const [items, locationId] = await Promise.all([priceItems(input.items), resolveLocationId(input.locationId)]);
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  // Order codes are per-day sequences; retry if two tills grab the same number.
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const code = await nextOrderCode(tx);
        const order = await tx.order.create({
          data: {
            code,
            paymentMethod: input.paymentMethod,
            subtotal,
            total: subtotal,
            customerName: input.customerName,
            note: input.note,
            locationId,
            items: { create: items },
          },
          include: orderInclude,
        });
        await logActivity(
          {
            action: "order.created",
            message: `${session.name} created order ${code}${order.location ? ` at ${order.location.name}` : ""} (${formatRupiah(order.total)})`,
            source: "POS",
            session,
            entityType: "order",
            entityId: order.id,
            meta: { total: order.total, items: items.length, paymentMethod: input.paymentMethod, locationId },
          },
          tx,
        );
        return order;
      });
    } catch (err) {
      const isCodeClash =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isCodeClash || attempt >= 4) throw err;
    }
  }
}

export async function payOrder(
  id: string,
  input: { paymentMethod: PaymentMethod; cashReceived?: number },
  session: Session,
  source: "POS" | "DASHBOARD" = "POS",
) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id } });
    if (order.status !== "PENDING") throw new HttpError(409, "This order has already been processed");

    if (input.paymentMethod === "CASH") {
      if (input.cashReceived == null || input.cashReceived < order.total) {
        throw new HttpError(400, "Cash received is less than the total");
      }
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: input.paymentMethod,
        cashReceived: input.paymentMethod === "CASH" ? input.cashReceived : null,
      },
      include: orderInclude,
    });
    await logActivity(
      {
        action: "order.paid",
        message: `${session.name} marked ${order.code} paid via ${input.paymentMethod} (${formatRupiah(order.total)})`,
        source,
        session,
        entityType: "order",
        entityId: id,
        meta: { total: order.total, paymentMethod: input.paymentMethod },
      },
      tx,
    );
    return updated;
  });
}

export async function cancelOrder(id: string, session: Session, source: "POS" | "DASHBOARD") {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id } });
    if (order.status === "CANCELLED") return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    if (order.status === "PAID" && session.role !== "ADMIN") {
      throw new HttpError(403, "Only an admin can cancel a paid order");
    }
    const updated = await tx.order.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: orderInclude,
    });
    await logActivity(
      {
        action: "order.cancelled",
        message: `${session.name} cancelled ${order.code}${order.status === "PAID" ? " (was paid)" : ""}`,
        source,
        session,
        entityType: "order",
        entityId: id,
        meta: { total: order.total, previousStatus: order.status },
      },
      tx,
    );
    return updated;
  });
}

export async function listOrders(params: {
  from?: Date;
  to?: Date;
  status?: "PENDING" | "PAID" | "CANCELLED";
  // "none" = orders without a location
  location?: string;
  q?: string;
  take?: number;
}) {
  return db.order.findMany({
    where: {
      createdAt: { gte: params.from, lt: params.to },
      status: params.status,
      ...(params.location ? { locationId: params.location === "none" ? null : params.location } : {}),
      ...(params.q
        ? {
            OR: [
              { code: { contains: params.q, mode: "insensitive" } },
              { customerName: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(params.take ?? 100, 500),
  });
}
