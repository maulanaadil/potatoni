import { NextResponse } from "next/server";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { pushDeviceInput } from "@/lib/validators";

// A device registers its token here after the user allows notifications.
export const POST = handler(async (request) => {
  const session = await requireApiSession();
  const { token, label } = await parseBody(request, pushDeviceInput);
  await db.pushDevice.upsert({
    where: { token },
    create: { token, label, userId: session.sub },
    update: { label, userId: session.sub, lastSeenAt: new Date() },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = handler(async (request) => {
  await requireApiSession();
  const { token } = await parseBody(request, pushDeviceInput);
  await db.pushDevice.deleteMany({ where: { token } });
  return NextResponse.json({ ok: true });
});
