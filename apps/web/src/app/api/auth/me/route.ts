import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";

export const GET = handler(async () => {
  const session = await requireApiSession();
  return NextResponse.json({
    user: { id: session.sub, name: session.name, email: session.email, role: session.role },
  });
});
