import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { getDashboardStats } from "@/lib/services/stats";

export const GET = handler(async (request) => {
  await requireApiSession("ADMIN");
  const days = Number(new URL(request.url).searchParams.get("days")) || 14;
  return NextResponse.json(await getDashboardStats(Math.min(Math.max(days, 1), 90)));
});
