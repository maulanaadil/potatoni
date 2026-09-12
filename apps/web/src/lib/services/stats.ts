import "server-only";
import { db } from "../db";
import { jakartaDateKey, startOfJakartaDay } from "../format";

export async function getDashboardStats(days = 14) {
  const today = startOfJakartaDay();
  const rangeStart = startOfJakartaDay(new Date(), -(days - 1));
  const monthStart = startOfJakartaDay(new Date(), -29);

  const [paidInRange, purchasesInRange, pendingToday, cancelledToday, topItems, paymentSplit] =
    await Promise.all([
      db.order.findMany({
        where: { status: "PAID", createdAt: { gte: rangeStart } },
        select: { createdAt: true, total: true },
      }),
      db.purchase.findMany({
        where: { purchasedAt: { gte: rangeStart } },
        select: { purchasedAt: true, total: true },
      }),
      db.order.count({ where: { status: "PENDING", createdAt: { gte: today } } }),
      db.order.count({ where: { status: "CANCELLED", createdAt: { gte: today } } }),
      db.orderItem.groupBy({
        by: ["productName", "variantSize"],
        where: { order: { status: "PAID", createdAt: { gte: monthStart } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 6,
      }),
      db.order.groupBy({
        by: ["paymentMethod"],
        where: { status: "PAID", createdAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
    ]);

  const series = new Map<string, { date: string; sales: number; purchases: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const key = jakartaDateKey(startOfJakartaDay(new Date(), -i));
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

  const todayRow = series.get(jakartaDateKey()) ?? { sales: 0, purchases: 0, orders: 0 };

  return {
    today: {
      sales: todayRow.sales,
      orders: todayRow.orders,
      purchases: todayRow.purchases,
      net: todayRow.sales - todayRow.purchases,
      averageTicket: todayRow.orders ? Math.round(todayRow.sales / todayRow.orders) : 0,
      pending: pendingToday,
      cancelled: cancelledToday,
    },
    series: [...series.values()],
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
