import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { modifierInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const data = await parseBody(request, modifierInput);
  const modifier = await db.modifier.update({ where: { id }, data });
  await logActivity({
    action: "modifier.updated",
    message: `${session.name} updated ${modifier.type.toLowerCase()} ${modifier.name}`,
    source: "DASHBOARD",
    session,
    entityType: "modifier",
    entityId: id,
  });
  return NextResponse.json({ modifier });
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const modifier = await db.modifier.delete({ where: { id } });
  await logActivity({
    action: "modifier.deleted",
    message: `${session.name} deleted ${modifier.type.toLowerCase()} ${modifier.name}`,
    source: "DASHBOARD",
    session,
    entityType: "modifier",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
});
