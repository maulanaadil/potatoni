"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Panel } from "@/components/ui/brand";
import { cn } from "@/lib/cn";
import { formatDay, formatRupiah, formatTime } from "@/lib/format";
import type { LocationSummary } from "@/lib/services/locations";
import type { DashboardStats } from "@/lib/services/stats";
import type { ActivityView } from "./activity-feed";
import { PageHeader } from "./common";
import { LocationCard, LocationStatusBadge, locationDates } from "./location-card";
import { SalesChart } from "./sales-chart";

type ActivityPage = { activities: ActivityView[]; nextCursor: string | null };

const STATUS_DOT: Record<LocationSummary["status"], string> = {
  current: "bg-leaf",
  upcoming: "bg-sun",
  ended: "bg-navy/25",
  unscheduled: "bg-navy/25",
};

export function Overview({
  initialFilter,
  initialStats,
  initialLocations,
  initialActivity,
}: {
  initialFilter: string;
  initialStats: DashboardStats;
  initialLocations: LocationSummary[];
  initialActivity: ActivityPage;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const { data, isLoading } = useSWR<DashboardStats>(`/api/admin/stats?location=${encodeURIComponent(filter)}`, {
    fallbackData: filter === initialFilter ? initialStats : undefined,
    refreshInterval: 30_000,
  });
  const stats = data ?? initialStats;
  const { data: locationData } = useSWR<{ locations: LocationSummary[] }>("/api/admin/locations", {
    fallbackData: { locations: initialLocations },
    refreshInterval: 60_000,
  });
  const locations = locationData?.locations ?? initialLocations;
  const { data: activity = initialActivity } = useSWR<ActivityPage>("/api/admin/activity", {
    fallbackData: initialActivity,
    refreshInterval: 30_000,
  });

  const selected = filter === "all" ? null : (locations.find((l) => (l.id ?? "none") === filter) ?? null);

  function choose(next: string) {
    setFilter(next);
    // Shareable URL without a server round-trip; SWR fetches the new stats.
    window.history.replaceState(null, "", next === "all" ? "/dashboard" : `/dashboard?location=${encodeURIComponent(next)}`);
  }

  const chip = (active: boolean) =>
    cn(
      "flex shrink-0 items-center gap-2 rounded-full border-2 border-navy px-4 py-1.5 font-display text-sm font-bold outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] pointer-coarse:min-h-11",
      active ? "bg-navy text-cream" : "bg-paper hover:bg-cream-deep",
    );

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          selected
            ? `How ${selected.name} is doing. Updates every 30 seconds.`
            : "Live numbers from every register. Updates every 30 seconds."
        }
      />

      {locations.length > 0 && (
        <nav aria-label="Filter by location" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <button type="button" aria-pressed={filter === "all"} className={chip(filter === "all")} onClick={() => choose("all")}>
            All locations
          </button>
          {locations.map((l) => {
            const value = l.id ?? "none";
            return (
              <button key={value} type="button" aria-pressed={filter === value} className={chip(filter === value)} onClick={() => choose(value)}>
                <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[l.status])} />
                {l.name}
              </button>
            );
          })}
        </nav>
      )}

      {/* Keep the old numbers on screen while the next location loads, just dimmed. */}
      <div className={cn("animate-rise transition-opacity duration-150 motion-reduce:animate-none", isLoading && "opacity-60")}>
        {selected ? <LocationView stats={stats} summary={selected} /> : <AllView stats={stats} />}

        {!selected && locations.length > 0 && (
          <section className="mt-6">
            <div className="mb-3">
              <h2 className="font-display text-2xl font-extrabold">Sales by location</h2>
              <p className="text-sm font-semibold text-navy-soft">All-time at each spot. Tap one to see its full breakdown.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {locations.map((l) => (
                <LocationCard key={l.id ?? "none"} summary={l} onSelect={() => choose(l.id ?? "none")} />
              ))}
            </div>
          </section>
        )}

        {!selected && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TopItems stats={stats} title="Best sellers" caption={`Portions sold, ${stats.range.label.toLowerCase()}`} />
            <Panel className="p-4 md:p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-extrabold">Latest activity</h2>
                <Link href="/dashboard/activity" className="text-sm font-bold text-navy-soft hover:text-navy">
                  See all →
                </Link>
              </div>
              <ul className="flex flex-col divide-y-2 divide-dotted divide-navy/15">
                {activity.activities.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-3 py-2 text-sm">
                    <span className="w-12 shrink-0 font-bold text-navy-soft tabular-nums">{formatTime(a.createdAt)}</span>
                    <span className="min-w-0">{a.message}</span>
                  </li>
                ))}
                {activity.activities.length === 0 && <li className="py-2 text-sm text-navy-soft">Nothing yet today.</li>}
              </ul>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}

function AllView({ stats }: { stats: DashboardStats }) {
  const { today } = stats;
  const qris = stats.paymentSplit.find((p) => p.method === "QRIS");
  const cash = stats.paymentSplit.find((p) => p.method === "CASH");
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        {/* Exactly one hero figure per view */}
        <Panel className="flex flex-col justify-between gap-4 bg-navy p-5 text-cream">
          <p className="font-display text-lg font-bold">Sales today</p>
          <p className="text-5xl leading-none font-extrabold md:text-6xl">{formatRupiah(today.sales)}</p>
          <p className="text-sm font-bold text-cream/80">
            {formatRupiah(stats.range.sales)} over the {stats.range.label.toLowerCase()} · QRIS {formatRupiah(qris?.total ?? 0)}, cash{" "}
            {formatRupiah(cash?.total ?? 0)}
          </p>
        </Panel>
        <Tiles
          tiles={[
            { label: "Paid orders", value: today.orders.toLocaleString("id-ID") },
            { label: "Average order", value: formatRupiah(today.averageTicket) },
            { label: "Stock purchases", value: formatRupiah(today.purchases) },
            { label: "Net today", value: formatRupiah(today.net), tone: today.net < 0 ? "text-tomato" : undefined },
            {
              label: "Awaiting payment",
              value: today.pending.toLocaleString("id-ID"),
              note: today.cancelled ? `${today.cancelled} cancelled` : undefined,
            },
          ]}
        />
      </div>
      <Panel className="mt-4 p-4 md:p-5">
        <SalesChart series={stats.series} />
      </Panel>
    </>
  );
}

function LocationView({ stats, summary }: { stats: DashboardStats; summary: LocationSummary }) {
  const { range } = stats;
  const qris = stats.paymentSplit.find((p) => p.method === "QRIS");
  const cash = stats.paymentSplit.find((p) => p.method === "CASH");
  const period = `${formatDay(range.from)} – ${formatDay(range.to)}`;

  // A spot that hasn't opened yet: explain instead of showing a zero-filled chart.
  if (summary.status === "upcoming" && range.orders === 0 && range.purchases === 0) {
    return (
      <Panel className="flex flex-col items-start gap-3 bg-navy p-6 text-cream">
        <div className="flex w-full items-start justify-between gap-3">
          <p className="font-display text-2xl font-extrabold">📍 {summary.name}</p>
          <LocationStatusBadge status={summary.status} />
        </div>
        <p className="text-4xl leading-none font-extrabold md:text-5xl">Opens {formatDay(summary.startsOn)}</p>
        <p className="max-w-xl text-sm font-semibold text-cream/80">
          {locationDates(summary)}
          {summary.address && ` · ${summary.address}`}. From that day the register tags every order and stock purchase
          here, and sales, net and best sellers show up on this page.
        </p>
      </Panel>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        <Panel className="flex flex-col justify-between gap-4 bg-navy p-5 text-cream">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">📍 {summary.name}</p>
              <p className="text-sm font-semibold text-cream/80">
                {summary.id ? locationDates(summary) : summary.notes}
                {summary.address && ` · ${summary.address}`}
              </p>
            </div>
            {summary.id && <LocationStatusBadge status={summary.status} />}
          </div>
          <p className="text-5xl leading-none font-extrabold md:text-6xl">{formatRupiah(range.sales)}</p>
          <p className="text-sm font-bold text-cream/80">
            {range.label} · {period}
          </p>
        </Panel>
        <Tiles
          tiles={[
            { label: "Paid orders", value: range.orders.toLocaleString("id-ID") },
            { label: "Average order", value: formatRupiah(range.averageTicket) },
            { label: "Per selling day", value: formatRupiah(range.salesPerDay), note: `${range.sellingDays} selling days` },
            { label: "Stock purchases", value: formatRupiah(range.purchases) },
            { label: "Net", value: formatRupiah(range.net), tone: range.net < 0 ? "text-tomato" : undefined },
            { label: "QRIS / Cash", value: `${formatRupiah(qris?.total ?? 0)}`, note: `Cash ${formatRupiah(cash?.total ?? 0)}` },
          ]}
        />
      </div>

      <Panel className="mt-4 p-4 md:p-5">
        <SalesChart series={stats.series} caption={`${period}, rupiah per day`} />
      </Panel>

      <div className="mt-4">
        <TopItems stats={stats} title="What sold here" caption={`Every product and size, ${range.label.toLowerCase()}`} />
      </div>
    </>
  );
}

function Tiles({ tiles }: { tiles: { label: string; value: string; note?: string; tone?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Panel key={tile.label} className="flex flex-col gap-1 p-4">
          <p className="text-sm font-bold text-navy-soft">{tile.label}</p>
          <p className={cn("text-2xl font-extrabold", tile.tone)}>{tile.value}</p>
          {tile.note && <p className="text-xs font-bold text-navy-soft">{tile.note}</p>}
        </Panel>
      ))}
    </div>
  );
}

function TopItems({ stats, title, caption }: { stats: DashboardStats; title: string; caption: string }) {
  const max = Math.max(1, ...stats.topItems.map((t) => t.quantity));
  return (
    <Panel className="p-4 md:p-5">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <p className="mb-4 text-sm font-semibold text-navy-soft">{caption}</p>
      {stats.topItems.length === 0 ? (
        <p className="text-sm text-navy-soft">No paid orders yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stats.topItems.map((item) => (
            <li key={item.name}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="font-bold">{item.name}</span>
                <span className="font-semibold text-navy-soft tabular-nums">
                  {item.quantity}× · {formatRupiah(item.revenue)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-chart-sales/15">
                <div className="h-full rounded-full bg-chart-sales" style={{ width: `${(item.quantity / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
