"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Modal recipe: centered, opacity + scale(0.96), 180ms strong ease-out in, 140ms out.
 * On phones it rises from the bottom edge instead, where the thumb is.
 * Movement sits behind `motion-safe:` so reduced motion really gets a plain fade
 * (a `motion-reduce:` override loses to the breakpoint variants in the cascade).
 * `instant` is for dialogs opened ~100×/day (product options): opacity only, no movement.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  instant = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  instant?: boolean;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          className={cn(
            "fixed inset-0 z-40 bg-navy/40 transition-opacity ease-out-strong",
            instant ? "duration-100" : "duration-180 data-ending-style:duration-140",
            "data-starting-style:opacity-0 data-ending-style:opacity-0",
          )}
        />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden border-2 border-navy bg-paper text-navy outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
            "md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(92vw,36rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:pb-0",
            "transition-[opacity,transform,translate,scale] ease-out-strong",
            "data-starting-style:opacity-0 data-ending-style:opacity-0",
            instant
              ? "duration-100"
              : [
                  "duration-180 data-ending-style:duration-140",
                  "motion-safe:max-md:data-starting-style:translate-y-full motion-safe:max-md:data-ending-style:translate-y-full",
                  "motion-safe:max-md:data-starting-style:opacity-100 motion-safe:max-md:data-ending-style:opacity-100",
                  "motion-safe:md:data-starting-style:scale-[0.96] motion-safe:md:data-ending-style:scale-[0.96]",
                ],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-navy/10 px-5 pt-5 pb-4">
            <div>
              <BaseDialog.Title className="font-display text-2xl leading-tight font-extrabold">{title}</BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-0.5 text-sm text-navy-soft">{description}</BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              aria-label="Close"
              className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-navy/15 text-xl outline-none transition-transform duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]"
            >
              ×
            </BaseDialog.Close>
          </div>
          {/* min-h-0 lets the body shrink and scroll so the footer stays on screen on phones */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && <div className="border-t-2 border-navy/10 bg-cream/60 px-5 py-4">{footer}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
