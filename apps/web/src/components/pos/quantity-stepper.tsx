"use client";

import { cn } from "@/lib/cn";

const step =
  "grid size-11 place-items-center rounded-xl font-display text-xl font-extrabold outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:opacity-30";

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 50,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-2xl border-2 border-navy bg-paper",
      )}
    >
      <button
        type="button"
        aria-label="Decrease"
        className={step}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="w-8 text-center font-display text-lg font-extrabold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Increase"
        className={step}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
