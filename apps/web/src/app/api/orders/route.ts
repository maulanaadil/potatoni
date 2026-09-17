import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { startOfJakartaDay } from "@/lib/format";
import { createOrder, listOrders } from "@/lib/services/orders";
import { createOrderInput } from "@/lib/validators";

// POS: today's orders (cashiers only see the current day).
export const GET = handler(async (request) => {
  await requireApiSession();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const orders = await listOrders({
    from: startOfJakartaDay(),
    status: status === "PENDING" || status === "PAID" || status === "CANCELLED" ? status : undefined,
  });
  return NextResponse.json({ orders });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession(["ADMIN", "CASHIER"]);
  const input = await parseBody(request, createOrderInput);
  const order = await createOrder(input, session);
  return NextResponse.json({ order }, { status: 201 });
});
