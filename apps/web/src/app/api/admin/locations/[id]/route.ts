import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, HttpError, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { locationInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const data = await parseBody(request, locationInput);
  const location = await db.location.update({ where: { id }, data });
  await logActivity({
    action: "location.updated",
    message: `${session.name} updated location ${location.name}`,
    source: "DASHBOARD",
    session,
    entityType: "location",
    entityId: id,
  });
  return NextResponse.json({ location });
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const [orders, purchases] = await Promise.all([
    db.order.count({ where: { locationId: id } }),
    db.purchase.count({ where: { locationId: id } }),
  ]);
  // Sales history must keep its location, so used locations are hidden instead of deleted.
  if (orders || purchases) {
    throw new HttpError(409, "This location has sales or purchases. Turn off “Active” to hide it instead.");
  }
  const location = await db.location.delete({ where: { id } });
  await logActivity({
    action: "location.deleted",
    message: `${session.name} deleted location ${location.name}`,
    source: "DASHBOARD",
    session,
    entityType: "location",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
});
