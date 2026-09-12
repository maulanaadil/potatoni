import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// text-base keeps iOS Safari from zooming into focused inputs.
// Shared by MoneyInput so every text-like field looks the same.
export const inputClass =
  "w-full rounded-xl border-2 border-navy/20 bg-white px-3 text-base font-semibold text-navy outline-none transition-[border-color,box-shadow] duration-150 ease-out-strong placeholder:font-normal placeholder:text-navy/35 focus:border-navy focus:ring-4 focus:ring-sun/40 disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, "h-11", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "h-11 pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-20 py-2", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="text-xs text-navy-soft">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold">
      <input type="checkbox" className="size-5 accent-navy" {...props} />
      {label}
    </label>
  );
}
