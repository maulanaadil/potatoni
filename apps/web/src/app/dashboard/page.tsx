import type { ActivityView } from "@/components/dashboard/activity-feed";
import { Overview } from "@/components/dashboard/overview";
import { db } from "@/lib/db";
import { getDashboardStats } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([
    getDashboardStats(14),
    db.activity.findMany({
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 51,
    }),
  ]);
  const page = recent.slice(0, 50);
  return (
    <Overview
      initialStats={stats}
      initialActivity={{
        activities: JSON.parse(JSON.stringify(page)) as ActivityView[],
        nextCursor: recent.length > 50 ? (page.at(-1)?.id ?? null) : null,
      }}
    />
  );
}
