import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { getMenu } from "@/lib/services/menu";
import { modifierInput } from "@/lib/validators";

export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  const { modifiers } = await getMenu({ includeInactive: true });
  return NextResponse.json({ modifiers });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const data = await parseBody(request, modifierInput);
  const modifier = await db.modifier.create({ data });
  await logActivity({
    action: "modifier.created",
    message: `${session.name} added ${modifier.type.toLowerCase()} ${modifier.name}`,
    source: "DASHBOARD",
    session,
    entityType: "modifier",
    entityId: modifier.id,
  });
  return NextResponse.json({ modifier }, { status: 201 });
});
