import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { orderInclude } from "@/lib/services/orders";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_request, { params }: Ctx) => {
  await requireApiSession();
  const { id } = await params;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  return NextResponse.json({ order });
});
