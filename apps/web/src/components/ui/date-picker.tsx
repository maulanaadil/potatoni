"use client";

import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import { type ChevronProps, DayPicker, type Matcher } from "react-day-picker";
import { cn } from "@/lib/cn";
import { formatDay, jakartaDateKey } from "@/lib/format";

// Values are calendar days ("YYYY-MM-DD"), handled as local dates so the grid never shifts a day.
const toDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const navButton =
  "grid size-10 place-items-center rounded-xl outline-none pointer-coarse:size-11 transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:opacity-30";

function Chevron({ orientation = "left", className }: ChevronProps) {
  const rotate = { left: "rotate-0", right: "rotate-180", up: "rotate-90", down: "-rotate-90" }[orientation];
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", rotate, className)}>
      <path
        d="M15 5 8 12l7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Brand date picker (Base UI Popover + react-day-picker).
 * Motion (animate skill → small popover): scale 0.96 + fade from the trigger's
 * transform-origin, 180ms in / 140ms out on the strong ease-out. Month changes don't
 * animate — they're frequent and keyboard-driven. Reduced motion keeps only the fade.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  clearable = false,
  placeholder = "Pick a date",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;
  const today = jakartaDateKey();
  const disabled: Matcher[] = [];
  if (min) disabled.push({ before: toDate(min) });
  if (max) disabled.push({ after: toDate(max) });
  const todayAllowed = (!min || today >= min) && (!max || today <= max);

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-xl border-2 border-navy/20 bg-white px-3 text-left text-base font-semibold text-navy outline-none",
          "transition-[border-color,box-shadow] duration-150 ease-out-strong focus-visible:border-navy focus-visible:ring-4 focus-visible:ring-sun/40 data-[popup-open]:border-navy",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 text-navy-soft">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className={cn("min-w-0 flex-1 truncate", !value && "font-normal text-navy/35")}>
          {value ? formatDay(value) : placeholder}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Above dialogs (z-50): most pickers live inside one. */}
        <Popover.Positioner sideOffset={8} align="start" collisionPadding={12} className="z-[60]">
          <Popover.Popup
            className={cn(
              "origin-[var(--transform-origin)] rounded-2xl border-2 border-navy bg-paper p-3 text-navy shadow-[0_6px_0_0_rgb(42_38_112/0.12)] outline-none",
              "transition-[opacity,scale] duration-180 ease-out-strong data-ending-style:duration-140",
              "data-starting-style:opacity-0 data-ending-style:opacity-0",
              "motion-safe:data-starting-style:scale-[0.96] motion-safe:data-ending-style:scale-[0.96]",
            )}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(d) => d && pick(toKey(d))}
              defaultMonth={selected ?? (min ? toDate(min) : undefined)}
              disabled={disabled}
              weekStartsOn={1}
              showOutsideDays
              fixedWeeks
              autoFocus
              components={{ Chevron }}
              classNames={{
                root: "w-[17.5rem] pointer-coarse:w-[19.25rem]",
                months: "relative",
                month: "flex flex-col gap-1",
                month_caption: "flex h-10 items-center justify-center",
                caption_label: "font-display text-lg font-extrabold",
                nav: "absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between",
                button_previous: navButton,
                button_next: navButton,
                chevron: "",
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday:
                  "w-10 pointer-coarse:w-11 pb-1 text-center text-xs font-bold tracking-wide text-navy-soft uppercase",
                week: "flex",
                day: "size-10 p-0 text-center pointer-coarse:size-11",
                day_button:
                  "grid size-10 place-items-center rounded-xl text-sm font-bold tabular-nums pointer-coarse:size-11 outline-none transition-[background-color,color,transform] duration-160 ease-out-strong hover:bg-sun/40 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:pointer-events-none",
                selected: "[&>button]:bg-navy [&>button]:text-cream [&>button]:hover:bg-navy",
                today:
                  "[&>button]:underline [&>button]:decoration-sun [&>button]:decoration-[3px] [&>button]:underline-offset-4",
                outside: "[&>button]:text-navy/35",
                disabled: "[&>button]:text-navy/25 [&>button]:line-through",
                hidden: "invisible",
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2 border-t-2 border-navy/10 pt-2">
              <button
                type="button"
                disabled={!todayAllowed}
                onClick={() => pick(today)}
                className="h-10 rounded-xl px-3 text-sm font-bold outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:opacity-30 pointer-coarse:h-11"
              >
                Today
              </button>
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="h-10 rounded-xl px-3 text-sm font-bold text-tomato outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-tomato/10 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] pointer-coarse:h-11"
                >
                  Clear
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
