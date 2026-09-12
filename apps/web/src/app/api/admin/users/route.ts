import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";

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
