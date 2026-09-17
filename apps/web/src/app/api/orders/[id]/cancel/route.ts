import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { cancelOrder } from "@/lib/services/orders";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession(["ADMIN", "CASHIER"]);
  const { id } = await params;
  const order = await cancelOrder(id, session, "POS");
  return NextResponse.json({ order });
});
