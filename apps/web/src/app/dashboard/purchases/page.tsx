import type { Metadata } from "next";
import { PurchaseTable } from "@/components/dashboard/purchase-table";
import { db } from "@/lib/db";
import { jakartaDateKey, startOfJakartaDay } from "@/lib/format";
import { getScheduledLocation, listLocations } from "@/lib/services/locations";
import type { PurchaseView } from "@/lib/views";

export const metadata: Metadata = { title: "Purchases" };

const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function DashboardPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; location?: string }>;
}) {
  const params = await searchParams;
  const from = isDay(params.from) ?? jakartaDateKey(startOfJakartaDay(new Date(), -29));
  const to = isDay(params.to) ?? jakartaDateKey();
  const location = params.location ?? "";

  const [purchases, locations, scheduled] = await Promise.all([
    db.purchase.findMany({
      where: {
        purchasedAt: {
          gte: startOfJakartaDay(new Date(`${from}T12:00:00+07:00`)),
          lt: startOfJakartaDay(new Date(`${to}T12:00:00+07:00`), 1),
        },
        ...(location ? { locationId: location === "none" ? null : location } : {}),
      },
      include: { location: { select: { id: true, name: true } } },
      orderBy: { purchasedAt: "desc" },
      take: 1000,
    }),
    listLocations({ includeInactive: true }),
    getScheduledLocation(),
  ]);

  return (
    <PurchaseTable
      purchases={JSON.parse(JSON.stringify(purchases)) as PurchaseView[]}
      filters={{ from, to, location }}
      locations={locations.map((l) => ({ id: l.id, name: l.name, isActive: l.isActive }))}
      scheduledId={scheduled?.id ?? null}
    />
  );
}
