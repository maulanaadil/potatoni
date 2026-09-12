import { Panel } from "@/components/ui/brand";
import { cn } from "@/lib/cn";
import { formatDay, formatRupiah } from "@/lib/format";
import type { LocationSummary } from "@/lib/services/locations";

const STATUS = {
  current: { label: "Selling now", className: "bg-leaf text-paper" },
  upcoming: { label: "Upcoming", className: "bg-sun text-navy" },
  ended: { label: "Ended", className: "bg-navy/10 text-navy-soft" },
  unscheduled: { label: "No dates", className: "bg-navy/10 text-navy-soft" },
} as const;

export function LocationStatusBadge({ status }: { status: LocationSummary["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide uppercase",
        STATUS[status].className,
      )}
    >
      {STATUS[status].label}
    </span>
  );
}

export function locationDates(l: Pick<LocationSummary, "startsOn" | "endsOn">) {
  if (!l.startsOn) return "No dates set";
  return `${formatDay(l.startsOn)} – ${l.endsOn ? formatDay(l.endsOn) : "until next move"}`;
}

/** One stall location at a glance: dates, money, and what sold there. */
export function LocationCard({
  summary,
  onSelect,
  action,
  productLimit = 3,
}: {
  summary: LocationSummary;
  onSelect?: () => void;
  action?: React.ReactNode;
  productLimit?: number;
}) {
  const maxQty = Math.max(1, ...summary.products.map((p) => p.quantity));
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight font-extrabold">📍 {summary.name}</p>
          <p className="truncate text-sm font-semibold text-navy-soft">
            {[summary.address, summary.id ? locationDates(summary) : summary.notes].filter(Boolean).join(" · ")}
          </p>
        </div>
        {summary.id && <LocationStatusBadge status={summary.status} />}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-cream px-3 py-2">
        <Stat label="Sales" value={formatRupiah(summary.sales)} strong />
        <Stat label="Orders" value={summary.orders.toLocaleString("id-ID")} />
        <Stat label="Net" value={formatRupiah(summary.net)} tone={summary.net < 0 ? "text-tomato" : undefined} />
        <Stat label="Per day" value={formatRupiah(summary.salesPerDay)} />
        <Stat label="Selling days" value={String(summary.sellingDays)} />
        <Stat label="Stock bought" value={formatRupiah(summary.purchases)} />
      </div>

      {summary.products.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {summary.products.slice(0, productLimit).map((p) => (
            <li key={p.name}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate font-bold">{p.name}</span>
                <span className="shrink-0 font-semibold text-navy-soft tabular-nums">{p.quantity}×</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-chart-sales/15">
                <div className="h-full rounded-full bg-chart-sales" style={{ width: `${(p.quantity / maxQty) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-navy-soft">No sales here yet.</p>
      )}
    </>
  );

  return (
    <Panel className="flex flex-col gap-3 p-4">
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="-m-1 flex flex-col gap-3 rounded-2xl p-1 text-left outline-none transition-transform duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.98]"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {action}
    </Panel>
  );
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-bold tracking-wide text-navy-soft uppercase">{label}</p>
      <p className={cn("truncate text-sm font-extrabold", strong && "text-base", tone)}>{value}</p>
    </div>
  );
}
