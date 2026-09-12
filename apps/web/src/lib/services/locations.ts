import "server-only";
import { HttpError } from "../api";
import { db } from "../db";
import { jakartaDateKey } from "../format";

/** Location dates are calendar days (@db.Date → UTC midnight). Compare as YYYY-MM-DD keys. */
export const dateKey = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
export const dayDate = (key: string) => new Date(`${key}T00:00:00Z`);

export type LocationStatus = "current" | "upcoming" | "ended" | "unscheduled";

export function locationStatus(
  loc: { startsOn: Date | null; endsOn: Date | null; isActive: boolean },
  today = jakartaDateKey(),
): LocationStatus {
  const start = dateKey(loc.startsOn);
  const end = dateKey(loc.endsOn);
  if (!start) return "unscheduled";
  if (start > today) return "upcoming";
  if (end && end < today) return "ended";
  return loc.isActive ? "current" : "ended";
}

/** The spot scheduled for a Jakarta calendar day; the most recently started one wins. */
export async function getScheduledLocation(day = jakartaDateKey()) {
  const date = dayDate(day);
  return db.location.findFirst({
    where: {
      isActive: true,
      startsOn: { lte: date },
      OR: [{ endsOn: null }, { endsOn: { gte: date } }],
    },
    orderBy: { startsOn: "desc" },
  });
}

/**
 * undefined → today's scheduled location (or none); null → explicitly no location;
 * id → must exist and be active.
 */
export async function resolveLocationId(input: string | null | undefined) {
  if (input === null) return null;
  if (input === undefined) return (await getScheduledLocation())?.id ?? null;
  const location = await db.location.findUnique({ where: { id: input } });
  if (!location || !location.isActive) throw new HttpError(400, "That location is no longer available");
  return location.id;
}

export async function listLocations({ includeInactive = false } = {}) {
  return db.location.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ startsOn: { sort: "desc", nulls: "last" } }, { name: "asc" }],
  });
}

export type LocationSummary = {
  id: string | null; // null = orders without a location
  name: string;
  address: string | null;
  notes: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  status: LocationStatus;
  orders: number;
  sales: number;
  purchases: number;
  net: number;
  sellingDays: number;
  salesPerDay: number;
  firstSale: string | null;
  lastSale: string | null;
  products: { name: string; quantity: number; revenue: number }[];
};

/** All-time performance per location (plus an "No location" bucket for untagged sales). */
export async function getLocationSummaries(): Promise<LocationSummary[]> {
  const [locations, orders, items, purchases] = await Promise.all([
    listLocations({ includeInactive: true }),
    db.order.findMany({
      where: { status: "PAID" },
      select: { locationId: true, createdAt: true, total: true },
    }),
    db.orderItem.findMany({
      where: { order: { status: "PAID" } },
      select: { productName: true, variantSize: true, quantity: true, lineTotal: true, order: { select: { locationId: true } } },
    }),
    db.purchase.groupBy({ by: ["locationId"], _sum: { total: true } }),
  ]);

  type Acc = { orders: number; sales: number; days: Set<string>; first?: Date; last?: Date; products: Map<string, { quantity: number; revenue: number }> };
  const acc = new Map<string | null, Acc>();
  const bucket = (id: string | null) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { orders: 0, sales: 0, days: new Set(), products: new Map() }));
    return a;
  };

  for (const o of orders) {
    const a = bucket(o.locationId);
    a.orders++;
    a.sales += o.total;
    a.days.add(jakartaDateKey(o.createdAt));
    if (!a.first || o.createdAt < a.first) a.first = o.createdAt;
    if (!a.last || o.createdAt > a.last) a.last = o.createdAt;
  }
  for (const i of items) {
    const a = bucket(i.order.locationId);
    const key = `${i.productName} ${i.variantSize}`;
    const p = a.products.get(key) ?? { quantity: 0, revenue: 0 };
    p.quantity += i.quantity;
    p.revenue += i.lineTotal;
    a.products.set(key, p);
  }
  const purchaseTotals = new Map(purchases.map((p) => [p.locationId, p._sum.total ?? 0]));

  const summarize = (id: string | null, base: Omit<LocationSummary, "orders" | "sales" | "purchases" | "net" | "sellingDays" | "salesPerDay" | "firstSale" | "lastSale" | "products">): LocationSummary => {
    const a = acc.get(id);
    const spent = purchaseTotals.get(id) ?? 0;
    const sales = a?.sales ?? 0;
    const days = a?.days.size ?? 0;
    return {
      ...base,
      orders: a?.orders ?? 0,
      sales,
      purchases: spent,
      net: sales - spent,
      sellingDays: days,
      salesPerDay: days ? Math.round(sales / days) : 0,
      firstSale: a?.first?.toISOString() ?? null,
      lastSale: a?.last?.toISOString() ?? null,
      products: [...(a?.products ?? new Map()).entries()]
        .map(([name, p]) => ({ name, ...p }))
        .sort((x, y) => y.quantity - x.quantity),
    };
  };

  const summaries = locations.map((l) =>
    summarize(l.id, {
      id: l.id,
      name: l.name,
      address: l.address,
      notes: l.notes,
      startsOn: dateKey(l.startsOn),
      endsOn: dateKey(l.endsOn),
      isActive: l.isActive,
      status: locationStatus(l),
    }),
  );

  const untagged = acc.get(null);
  if (untagged || purchaseTotals.get(null)) {
    summaries.push(
      summarize(null, {
        id: null,
        name: "No location",
        address: null,
        notes: "Sales recorded before a location was set",
        startsOn: null,
        endsOn: null,
        isActive: false,
        status: "unscheduled",
      }),
    );
  }
  return summaries;
}
