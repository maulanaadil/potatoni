"use client";

import { type ComponentProps, type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "./field";

const MAX_DIGITS = 12; // Rp 999.999.999.999 is plenty for a fries stall

/** Keep only digits and drop leading zeros ("007" → "7", "0" stays "0"). */
export const toDigits = (raw: string | number | null | undefined) =>
  String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_DIGITS);

const group = (digits: string) => (digits ? Number(digits).toLocaleString("id-ID") : "");

/**
 * Rupiah input: shows "Rp 50.000" while typing and hands the form plain digits ("50000").
 * The caret stays where you're typing even though the dots move, and Backspace/Delete
 * skip over a dot instead of getting stuck on it.
 */
export function MoneyInput({
  value,
  onValueChange,
  onKeyDown,
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  value: string | number | null | undefined;
  onValueChange: (digits: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  // How many digits sat before the caret, so it can be put back after re-grouping.
  const caretDigits = useRef<number | null>(null);
  const display = group(toDigits(value));

  useLayoutEffect(() => {
    const el = input.current;
    if (!el || caretDigits.current === null || document.activeElement !== el) return;
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < caretDigits.current; pos++) {
      if (/\d/.test(el.value[pos]!)) seen++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  });

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    if (start === el.selectionEnd) {
      if (e.key === "Backspace" && start > 0 && /\D/.test(el.value[start - 1]!))
        el.setSelectionRange(start - 1, start - 1);
      if (e.key === "Delete" && start < el.value.length && /\D/.test(el.value[start]!))
        el.setSelectionRange(start + 1, start + 1);
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base font-bold text-navy-soft"
      >
        Rp
      </span>
      <input
        {...props}
        ref={input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          const el = e.target;
          caretDigits.current = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, "").length;
          onValueChange(toDigits(el.value));
        }}
        className={cn(inputClass, "h-11 pl-11 tabular-nums", className)}
      />
    </div>
  );
}
