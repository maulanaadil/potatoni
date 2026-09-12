import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";

// ?source=POS|DASHBOARD&action=order.&cursor=<id>
export const GET = handler(async (request) => {
  await requireApiSession("ADMIN");
  const url = new URL(request.url);
  const source = url.searchParams.get("source");
  const action = url.searchParams.get("action");
  const cursor = url.searchParams.get("cursor");

  const activities = await db.activity.findMany({
    where: {
      source: source === "POS" || source === "DASHBOARD" ? source : undefined,
      action: action ? { startsWith: action } : undefined,
    },
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = activities.length > 50;
  const page = activities.slice(0, 50);
  return NextResponse.json({ activities: page, nextCursor: hasMore ? page.at(-1)?.id : null });
});
