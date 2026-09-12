import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, HttpError, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { userInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };
const select = { id: true, name: true, email: true, role: true, createdAt: true } as const;

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const { password, ...data } = await parseBody(request, userInput);
  if (id === session.sub && data.role !== "ADMIN") {
    throw new HttpError(400, "You can't remove your own admin access");
  }
  const user = await db.user.update({
    where: { id },
    data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select,
  });
  await logActivity({
    action: "user.updated",
    message: `${session.name} updated account ${user.name}${password ? " (password reset)" : ""}`,
    source: "DASHBOARD",
    session,
    entityType: "user",
    entityId: id,
  });
  return NextResponse.json({ user });
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  if (id === session.sub) throw new HttpError(400, "You can't delete your own account");
  const user = await db.user.delete({ where: { id }, select });
  await logActivity({
    action: "user.deleted",
    message: `${session.name} deleted account ${user.name}`,
    source: "DASHBOARD",
    session,
    entityType: "user",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
});
