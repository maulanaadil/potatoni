import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/format";
import { resolveLocationId } from "@/lib/services/locations";
import { purchaseInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const { locationId, ...input } = await parseBody(request, purchaseInput);
  const purchase = await db.purchase.update({
    where: { id },
    // Editing keeps the current location unless the admin picks another one.
    data: { ...input, ...(locationId !== undefined ? { locationId: await resolveLocationId(locationId) } : {}) },
  });
  await logActivity({
    action: "purchase.updated",
    message: `${session.name} edited purchase ${purchase.item} (${formatRupiah(purchase.total)})`,
    source: "DASHBOARD",
    session,
    entityType: "purchase",
    entityId: id,
  });
  return NextResponse.json({ purchase });
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const purchase = await db.purchase.delete({ where: { id } });
  await logActivity({
    action: "purchase.deleted",
    message: `${session.name} deleted purchase ${purchase.item} (${formatRupiah(purchase.total)})`,
    source: "DASHBOARD",
    session,
    entityType: "purchase",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
});
