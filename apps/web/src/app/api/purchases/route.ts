import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { formatRupiah, startOfJakartaDay } from "@/lib/format";
import { resolveLocationId } from "@/lib/services/locations";
import { purchaseInput } from "@/lib/validators";

const purchaseInclude = { location: { select: { id: true, name: true } } } as const;

// Cashiers see today's stock purchases; admins can pass ?from=&to= (YYYY-MM-DD, WIB)
// and ?location=<id>|none.
export const GET = handler(async (request) => {
  const session = await requireApiSession();
  const url = new URL(request.url);
  const isAdmin = session.role === "ADMIN";
  const from = isAdmin && url.searchParams.get("from")
    ? startOfJakartaDay(new Date(`${url.searchParams.get("from")}T12:00:00+07:00`))
    : startOfJakartaDay();
  const to = isAdmin && url.searchParams.get("to")
    ? startOfJakartaDay(new Date(`${url.searchParams.get("to")}T12:00:00+07:00`), 1)
    : undefined;
  const location = isAdmin ? url.searchParams.get("location") : null;

  const purchases = await db.purchase.findMany({
    where: {
      purchasedAt: { gte: from, lt: to },
      ...(location ? { locationId: location === "none" ? null : location } : {}),
    },
    include: purchaseInclude,
    orderBy: { purchasedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ purchases });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession();
  const { locationId: requested, ...input } = await parseBody(request, purchaseInput);
  const locationId = await resolveLocationId(requested);
  const purchase = await db.purchase.create({ data: { ...input, locationId }, include: purchaseInclude });
  await logActivity({
    action: "purchase.created",
    message: `${session.name} bought ${purchase.quantity} ${purchase.unit} ${purchase.item}${purchase.location ? ` for ${purchase.location.name}` : ""} (${formatRupiah(purchase.total)})`,
    source: session.role === "ADMIN" ? "DASHBOARD" : "POS",
    session,
    entityType: "purchase",
    entityId: purchase.id,
    meta: { total: purchase.total, locationId },
  });
  return NextResponse.json({ purchase }, { status: 201 });
});
