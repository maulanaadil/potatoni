"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import useSWR from "swr";
import { Panel } from "@/components/ui/brand";
import { formatRupiah, formatTime } from "@/lib/format";
import type { DashboardStats } from "@/lib/services/stats";
import type { ActivityView } from "./activity-feed";
import { PageHeader } from "./common";
import { SalesChart } from "./sales-chart";

type ActivityPage = { activities: ActivityView[]; nextCursor: string | null };

export function Overview({
  initialStats,
  initialActivity,
}: {
  initialStats: DashboardStats;
  initialActivity: ActivityPage;
}) {
  const { data: stats = initialStats } = useSWR<DashboardStats>("/api/admin/stats", {
    fallbackData: initialStats,
    refreshInterval: 30_000,
  });
  const { data: activity = initialActivity } = useSWR<ActivityPage>("/api/admin/activity", {
    fallbackData: initialActivity,
    refreshInterval: 30_000,
  });

  const { today } = stats;
  const topMax = Math.max(1, ...stats.topItems.map((t) => t.quantity));
  const qris = stats.paymentSplit.find((p) => p.method === "QRIS");
  const cash = stats.paymentSplit.find((p) => p.method === "CASH");

  const tiles = [
    { label: "Paid orders", value: today.orders.toLocaleString("id-ID") },
    { label: "Average order", value: formatRupiah(today.averageTicket) },
    { label: "Stock purchases", value: formatRupiah(today.purchases) },
    {
      label: "Net today",
      value: formatRupiah(today.net),
      tone: today.net < 0 ? "text-tomato" : undefined,
    },
    {
      label: "Awaiting payment",
      value: today.pending.toLocaleString("id-ID"),
      note: today.cancelled ? `${today.cancelled} cancelled` : undefined,
    },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Live numbers from every register. Updates every 30 seconds." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        {/* Exactly one hero figure per view */}
        <Panel className="flex animate-rise flex-col justify-between gap-4 bg-navy p-5 text-cream motion-reduce:animate-none">
          <p className="font-display text-lg font-bold">Sales today</p>
          <p className="text-5xl leading-none font-extrabold md:text-6xl">{formatRupiah(today.sales)}</p>
          <div className="flex gap-4 text-sm font-bold text-cream/75">
            <span>QRIS {formatRupiah(qris?.total ?? 0)}</span>
            <span>Cash {formatRupiah(cash?.total ?? 0)}</span>
          </div>
        </Panel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {tiles.map((tile, i) => (
            <Panel
              key={tile.label}
              style={{ animationDelay: `${(i + 1) * 40}ms` }}
              className="flex animate-rise flex-col gap-1 p-4 motion-reduce:animate-none"
            >
              <p className="text-sm font-bold text-navy/60">{tile.label}</p>
              <p className={cn("text-2xl font-extrabold", tile.tone)}>{tile.value}</p>
              {tile.note && <p className="text-xs font-bold text-navy/50">{tile.note}</p>}
            </Panel>
          ))}
        </div>
      </div>

      <Panel className="mt-4 p-4 md:p-5">
        <SalesChart series={stats.series} />
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-4 md:p-5">
          <h2 className="font-display text-xl font-extrabold">Best sellers</h2>
          <p className="mb-4 text-sm font-semibold text-navy/60">Portions sold, last 30 days</p>
          {stats.topItems.length === 0 ? (
            <p className="text-sm text-navy/55">No paid orders yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {stats.topItems.map((item) => (
                <li key={item.name}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="font-bold">{item.name}</span>
                    <span className="font-semibold text-navy/60 tabular-nums">
                      {item.quantity}× · {formatRupiah(item.revenue)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-chart-sales/15">
                    <div
                      className="h-full rounded-full bg-chart-sales"
                      style={{ width: `${(item.quantity / topMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-4 md:p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-extrabold">Latest activity</h2>
            <Link href="/dashboard/activity" className="text-sm font-bold text-navy/60 hover:text-navy">
              See all →
            </Link>
          </div>
          <ul className="flex flex-col divide-y-2 divide-dotted divide-navy/15">
            {activity.activities.slice(0, 8).map((a) => (
              <li key={a.id} className="flex gap-3 py-2 text-sm">
                <span className="w-12 shrink-0 font-bold text-navy/50 tabular-nums">{formatTime(a.createdAt)}</span>
                <span className="min-w-0">{a.message}</span>
              </li>
            ))}
            {activity.activities.length === 0 && <li className="py-2 text-sm text-navy/55">Nothing yet today.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
