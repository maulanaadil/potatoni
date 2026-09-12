import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, HttpError, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { cancelOrder, orderInclude, payOrder } from "@/lib/services/orders";
import { orderStatusInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_request, { params }: Ctx) => {
  await requireApiSession("ADMIN");
  const { id } = await params;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  return NextResponse.json({ order });
});

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const { status } = await parseBody(request, orderStatusInput);

  if (status === "CANCELLED") {
    return NextResponse.json({ order: await cancelOrder(id, session, "DASHBOARD") });
  }
  if (status === "PAID") {
    const existing = await db.order.findUniqueOrThrow({ where: { id } });
    const order = await payOrder(
      id,
      { paymentMethod: existing.paymentMethod, cashReceived: existing.total },
      session,
      "DASHBOARD",
    );
    return NextResponse.json({ order });
  }
  throw new HttpError(400, "An order can't be moved back to pending");
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const order = await db.order.delete({ where: { id } });
  await logActivity({
    action: "order.deleted",
    message: `${session.name} permanently deleted order ${order.code}`,
    source: "DASHBOARD",
    session,
    entityType: "order",
    entityId: id,
    meta: { total: order.total, status: order.status },
  });
  return NextResponse.json({ ok: true });
});
