"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/format";
import { useCurrentLocation } from "./location-context";

/** "📍 Selling at SMA Trinitas Bandung" — every order and purchase is tagged with this spot. */
export function LocationBar() {
  const { locations, scheduledId, locationId, location, isOverride, choose, followSchedule } = useCurrentLocation();
  const [open, setOpen] = useState(false);

  if (locations.length === 0) return null;

  const pick = (id: string | null) => {
    if (id === scheduledId) followSchedule();
    else choose(id);
    setOpen(false);
  };

  return (
    <>
      <div className={cn("border-b-2 border-navy", location ? "bg-paper" : "bg-sun")}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 md:px-6">
          <span aria-hidden className="text-lg">
            📍
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {location ? (
              <>
                Selling at <span className="font-extrabold">{location.name}</span>
                <span className="text-navy-soft"> · {isOverride ? "picked for today" : "scheduled today"}</span>
              </>
            ) : (
              <span className="font-extrabold">No location set</span>
            )}
          </p>
          <Button intent={location ? "outline" : "primary"} size="sm" onClick={() => setOpen(true)}>
            {location ? "Change" : "Set location"}
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Where are we selling today?"
        description="New orders and stock purchases are grouped under this location."
      >
        <ul className="flex flex-col gap-2">
          {locations.map((l) => (
            <li key={l.id}>
              <LocationOption
                selected={l.id === locationId}
                onClick={() => pick(l.id)}
                title={l.name}
                subtitle={[l.address, dateRange(l.startsOn, l.endsOn)].filter(Boolean).join(" · ")}
                badge={l.id === scheduledId ? "Scheduled today" : undefined}
              />
            </li>
          ))}
          <li>
            <LocationOption
              selected={locationId === null}
              onClick={() => pick(null)}
              title="No location"
              subtitle="Sales stay ungrouped"
            />
          </li>
        </ul>
      </Dialog>
    </>
  );
}

function dateRange(start: string | null, end: string | null) {
  if (!start) return "";
  return `${formatDay(start, false)} – ${end ? formatDay(end, false) : "until next move"}`;
}

function LocationOption({
  selected,
  onClick,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  // Plain buttons, not radios: picking one closes the dialog, and native radios would fire
  // on every arrow key.
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-sun/70 transition-[background-color,border-color,transform] duration-160 ease-out-strong active:scale-[0.98]",
        selected ? "border-navy bg-sun/70" : "border-navy/15 bg-white hover:border-navy/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2 border-navy",
          selected && "bg-navy",
        )}
      >
        {selected && <span className="size-2 rounded-full bg-cream" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg leading-tight font-extrabold">{title}</span>
        {subtitle && <span className="block truncate text-sm text-navy-soft">{subtitle}</span>}
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-extrabold text-leaf uppercase">
          {badge}
        </span>
      )}
    </button>
  );
}
