import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { startOfJakartaDay } from "@/lib/format";
import { listOrders } from "@/lib/services/orders";

const dayFromParam = (value: string | null, offset = 0) =>
  value ? startOfJakartaDay(new Date(`${value}T12:00:00+07:00`), offset) : undefined;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=PAID&location=<id>|none&q=PTN-2609
export const GET = handler(async (request) => {
  await requireApiSession("ADMIN");
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const orders = await listOrders({
    from: dayFromParam(url.searchParams.get("from")),
    to: dayFromParam(url.searchParams.get("to"), 1),
    status: status === "PENDING" || status === "PAID" || status === "CANCELLED" ? status : undefined,
    location: url.searchParams.get("location") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    take: Number(url.searchParams.get("take")) || 200,
  });
  return NextResponse.json({ orders });
});
