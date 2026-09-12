import { cn } from "@/lib/cn";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { formatK } from "@/lib/format";

/** Rounded navy-outlined box, like the sections on the menu board. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-3xl border-2 border-navy bg-paper", className)}
      {...props}
    />
  );
}

/** Brush-stroke section heading ("FRIES", "ADD-ONS"). */
export function SectionTag({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      {icon && (
        <span className="relative z-10 grid size-11 place-items-center rounded-full border-2 border-navy bg-navy text-xl text-sun">
          {icon}
        </span>
      )}
      <h2
        className={cn(
          "bg-navy py-1 pr-6 font-display text-xl font-extrabold uppercase leading-tight tracking-wide text-cream",
          "[clip-path:polygon(0_0,100%_6%,96%_28%,100%_50%,95%_72%,100%_94%,0_100%)]",
          icon ? "-ml-3 pl-5" : "pl-4",
        )}
      >
        {children}
      </h2>
    </div>
  );
}

export function Pill({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sun px-3 py-0.5 font-display text-sm font-bold uppercase tracking-wide text-navy",
        className,
      )}
      {...props}
    />
  );
}

/** "M — 150g ········ 22K" */
export function PriceRow({
  size,
  grams,
  price,
  popular,
  className,
}: {
  size: string;
  grams: number;
  price: number;
  popular?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex w-full items-baseline gap-2 font-display", className)}>
      <span className="w-6 text-xl font-extrabold">{size}</span>
      <span className="text-sm font-semibold text-navy/70">— {grams}g</span>
      {popular && (
        <span aria-label="Best seller" className="text-sun">
          ★
        </span>
      )}
      <span aria-hidden className="mx-1 flex-1 translate-y-[-5px] border-b-2 border-dotted border-navy/35" />
      <span className="text-xl font-extrabold">{formatK(price)}</span>
    </span>
  );
}

export function Sparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" fill="none" aria-hidden className={className}>
      <path
        d="M14 6c1.5 9 4 11.5 12 13-8 1.5-10.5 4-12 13-1.5-9-4-11.5-12-13 8-1.5 10.5-4 12-13Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M58 2c1 6 3 8 8 9-5 1-7 3-8 9-1-6-3-8-8-9 5-1 7-3 8-9Z"
        className="text-sun"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M100 26c1 6 3 8 8 9-5 1-7 3-8 9-1-6-3-8-8-9 5-1 7-3 8-9Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/api/media/brand/logo.webp"
      alt="Potatoni — crispy outside, happy inside"
      width={460}
      height={281}
      priority={priority}
      className={className}
    />
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-navy/30 px-6 py-12 text-center">
      <Sparkles className="h-8 text-navy/40" />
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <p className="max-w-sm text-sm text-navy-soft">{children}</p>}
    </div>
  );
}

const STATUS_STYLES = {
  PENDING: "bg-sun text-navy",
  PAID: "bg-leaf text-paper",
  CANCELLED: "bg-navy/10 text-navy-soft line-through",
} as const;
const STATUS_LABELS = { PENDING: "Awaiting payment", PAID: "Paid", CANCELLED: "Cancelled" } as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_STYLES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
