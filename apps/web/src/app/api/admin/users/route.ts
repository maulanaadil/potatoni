import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, HttpError, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { userInput } from "@/lib/validators";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  const users = await db.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ users });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const { password, ...data } = await parseBody(request, userInput);
  if (!password) throw new HttpError(400, "Password is required for new accounts");
  const user = await db.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
    select: userSelect,
  });
  await logActivity({
    action: "user.created",
    message: `${session.name} created ${user.role.toLowerCase()} account ${user.name}`,
    source: "DASHBOARD",
    session,
    entityType: "user",
    entityId: user.id,
  });
  return NextResponse.json({ user }, { status: 201 });
});
