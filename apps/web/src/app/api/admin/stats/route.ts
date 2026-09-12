import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { getDashboardStats } from "@/lib/services/stats";

export const GET = handler(async (request) => {
  await requireApiSession("ADMIN");
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days")) || 14;
  // ?location=all|none|<id> — a specific location charts its own run.
  const location = url.searchParams.get("location") || "all";
  return NextResponse.json(await getDashboardStats({ location, days: Math.min(Math.max(days, 1), 90) }));
});
