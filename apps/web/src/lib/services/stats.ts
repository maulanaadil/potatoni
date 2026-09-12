import "server-only";
import { HttpError } from "../api";
import { db } from "../db";
import { jakartaDateKey, startOfJakartaDay } from "../format";
import { dateKey } from "./locations";

/** "all" = every sale, "none" = sales without a location, otherwise a location id. */
export type LocationFilter = "all" | "none" | (string & {});

const MAX_DAYS = 90;
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
/** UTC instant of 00:00 WIB for a Jakarta date key. */
const wibStart = (key: string) => startOfJakartaDay(new Date(`${key}T12:00:00+07:00`));

/**
 * Picks the chart window: a location's own run (clamped to today and 90 days),
 * otherwise the last `days` days.
 */
async function resolveRange(location: LocationFilter, days: number) {
  const today = jakartaDateKey();
  const fallback = { from: addDays(today, -(days - 1)), to: today, label: `Last ${days} days` };
  if (location === "all" || location === "none") return { ...fallback, location: null };

  const loc = await db.location.findUnique({ where: { id: location } });
  if (!loc) throw new HttpError(404, "Location not found");
  const start = dateKey(loc.startsOn);
  const end = dateKey(loc.endsOn);
  if (!start || start > today) return { ...fallback, location: loc };

  const to = end && end < today ? end : today;
  const from = daysBetween(start, to) > MAX_DAYS ? addDays(to, -(MAX_DAYS - 1)) : start;
  return {
    from,
    to,
    label: from === start ? "Whole run at this location" : `Last ${MAX_DAYS} days here`,
    location: loc,
  };
}

export async function getDashboardStats({
  location = "all",
  days = 14,
}: {
  location?: LocationFilter;
  days?: number;
} = {}) {
  const range = await resolveRange(location, days);
  const where = location === "all" ? {} : { locationId: location === "none" ? null : location };
  const rangeFrom = wibStart(range.from);
  const rangeTo = startOfJakartaDay(new Date(`${range.to}T12:00:00+07:00`), 1);
  const today = startOfJakartaDay();

  const [paidInRange, purchasesInRange, pendingToday, cancelledToday, topItems, paymentSplit] = await Promise.all([
    db.order.findMany({
      where: { ...where, status: "PAID", createdAt: { gte: rangeFrom, lt: rangeTo } },
      select: { createdAt: true, total: true },
    }),
    db.purchase.findMany({
      where: { ...where, purchasedAt: { gte: rangeFrom, lt: rangeTo } },
      select: { purchasedAt: true, total: true },
    }),
    db.order.count({ where: { ...where, status: "PENDING", createdAt: { gte: today } } }),
    db.order.count({ where: { ...where, status: "CANCELLED", createdAt: { gte: today } } }),
    db.orderItem.groupBy({
      by: ["productName", "variantSize"],
      where: { order: { ...where, status: "PAID", createdAt: { gte: rangeFrom, lt: rangeTo } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    db.order.groupBy({
      by: ["paymentMethod"],
      where: { ...where, status: "PAID", createdAt: { gte: rangeFrom, lt: rangeTo } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const series = new Map<string, { date: string; sales: number; purchases: number; orders: number }>();
  for (let i = 0; i < daysBetween(range.from, range.to); i++) {
    const key = addDays(range.from, i);
    series.set(key, { date: key, sales: 0, purchases: 0, orders: 0 });
  }
  for (const o of paidInRange) {
    const row = series.get(jakartaDateKey(o.createdAt));
    if (row) {
      row.sales += o.total;
      row.orders += 1;
    }
  }
  for (const p of purchasesInRange) {
    const row = series.get(jakartaDateKey(p.purchasedAt));
    if (row) row.purchases += p.total;
  }

  const rows = [...series.values()];
  const todayRow = series.get(jakartaDateKey()) ?? { sales: 0, purchases: 0, orders: 0 };
  const totals = rows.reduce(
    (t, r) => ({ sales: t.sales + r.sales, purchases: t.purchases + r.purchases, orders: t.orders + r.orders }),
    { sales: 0, purchases: 0, orders: 0 },
  );
  const sellingDays = rows.filter((r) => r.orders > 0).length;

  return {
    location: range.location ? { id: range.location.id, name: range.location.name } : null,
    range: {
      from: range.from,
      to: range.to,
      label: range.label,
      ...totals,
      net: totals.sales - totals.purchases,
      averageTicket: totals.orders ? Math.round(totals.sales / totals.orders) : 0,
      sellingDays,
      salesPerDay: sellingDays ? Math.round(totals.sales / sellingDays) : 0,
    },
    today: {
      sales: todayRow.sales,
      orders: todayRow.orders,
      purchases: todayRow.purchases,
      net: todayRow.sales - todayRow.purchases,
      averageTicket: todayRow.orders ? Math.round(todayRow.sales / todayRow.orders) : 0,
      pending: pendingToday,
      cancelled: cancelledToday,
    },
    series: rows,
    topItems: topItems.map((t) => ({
      name: `${t.productName} ${t.variantSize}`,
      quantity: t._sum.quantity ?? 0,
      revenue: t._sum.lineTotal ?? 0,
    })),
    paymentSplit: paymentSplit.map((p) => ({
      method: p.paymentMethod,
      total: p._sum.total ?? 0,
      count: p._count,
    })),
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
