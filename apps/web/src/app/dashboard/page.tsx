import type { ActivityView } from "@/components/dashboard/activity-feed";
import { Overview } from "@/components/dashboard/overview";
import { db } from "@/lib/db";
import { getLocationSummaries } from "@/lib/services/locations";
import { getDashboardStats } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const { location: requested } = await searchParams;
  const locations = await getLocationSummaries();
  // Ignore stale ?location= links to deleted locations.
  const location =
    requested && (requested === "none" || locations.some((l) => l.id === requested)) ? requested : "all";

  const [stats, recent] = await Promise.all([
    getDashboardStats({ location }),
    db.activity.findMany({
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 51,
    }),
  ]);
  const page = recent.slice(0, 50);
  return (
    <Overview
      initialFilter={location}
      initialStats={stats}
      initialLocations={locations}
      initialActivity={{
        activities: JSON.parse(JSON.stringify(page)) as ActivityView[],
        nextCursor: recent.length > 50 ? (page.at(-1)?.id ?? null) : null,
      }}
    />
  );
}
