import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { payOrder } from "@/lib/services/orders";
import { payOrderInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession(["ADMIN", "CASHIER"]);
  const { id } = await params;
  const input = await parseBody(request, payOrderInput);
  const order = await payOrder(id, input, session);
  return NextResponse.json({ order });
});
