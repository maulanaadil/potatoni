"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatK, formatRupiah } from "@/lib/format";
import type { DashboardStats } from "@/lib/services/stats";

// Validated pair (see globals.css --color-chart-*). Text never wears these colors.
const SERIES = [
  { key: "sales", label: "Sales", color: "#4b478f" },
  { key: "purchases", label: "Stock purchases", color: "#c9651a" },
] as const;

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

type Row = DashboardStats["series"][number];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-xl border-2 border-navy bg-paper px-3 py-2 text-sm shadow-[0_4px_0_0_rgb(42_38_112/0.15)]">
      <p className="mb-1 font-extrabold">{dayLabel(row.date)}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          <span className="text-navy/70">{s.label}</span>
          <span className="ml-auto pl-3 font-bold tabular-nums">{formatRupiah(row[s.key])}</span>
        </p>
      ))}
      <p className="mt-1 border-t border-navy/15 pt-1 text-navy/70">
        {row.orders} orders · net <span className="font-bold text-navy">{formatRupiah(row.sales - row.purchases)}</span>
      </p>
    </div>
  );
}

export function SalesChart({ series }: { series: DashboardStats["series"] }) {
  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <figcaption>
          <h2 className="font-display text-xl font-extrabold">Sales vs stock purchases</h2>
          <p className="text-sm font-semibold text-navy/60">Last {series.length} days, rupiah per day</p>
        </figcaption>
        {/* Legend: always present for 2 series; swatch carries identity, text stays ink */}
        <ul className="flex gap-4 text-sm font-bold">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7dccb" strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              tickLine={false}
              axisLine={{ stroke: "#e7dccb" }}
              tick={{ fill: "rgb(42 38 112 / 0.6)", fontSize: 12, fontWeight: 700 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              // Keep a sensible scale on empty days so ticks never read "0.0K".
              domain={[0, (max: number) => Math.max(max, 100_000)]}
              tickFormatter={(v: number) => (v === 0 ? "0" : formatK(v))}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "rgb(42 38 112 / 0.6)", fontSize: 12, fontWeight: 700 }}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(42 38 112 / 0.06)" }} />
            {/* Polling refreshes data every 30s — replaying a grow-in each time would be noise. */}
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                maxBarSize={18}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-bold text-navy/70 hover:text-navy">Show as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-xs uppercase text-navy/60">
              <tr>
                <th className="py-1 pr-4">Day</th>
                <th className="py-1 pr-4 text-right">Orders</th>
                <th className="py-1 pr-4 text-right">Sales</th>
                <th className="py-1 pr-4 text-right">Purchases</th>
                <th className="py-1 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {[...series].reverse().map((row) => (
                <tr key={row.date}>
                  <td className="py-1 pr-4 font-bold">{dayLabel(row.date)}</td>
                  <td className="py-1 pr-4 text-right">{row.orders}</td>
                  <td className="py-1 pr-4 text-right">{formatRupiah(row.sales)}</td>
                  <td className="py-1 pr-4 text-right">{formatRupiah(row.purchases)}</td>
                  <td className="py-1 text-right font-bold">{formatRupiah(row.sales - row.purchases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
