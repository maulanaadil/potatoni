import type { Metadata } from "next";
import { ActivityFeed, type ActivityView } from "@/components/dashboard/activity-feed";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const activities = await db.activity.findMany({
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 51,
  });
  const page = activities.slice(0, 50);
  return (
    <ActivityFeed
      initial={JSON.parse(JSON.stringify(page)) as ActivityView[]}
      initialCursor={activities.length > 50 ? (page.at(-1)?.id ?? null) : null}
    />
  );
}
