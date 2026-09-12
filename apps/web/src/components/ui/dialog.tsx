"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Modal recipe: centered, opacity + scale(0.96), 180ms strong ease-out in,
 * 140ms out (it opens for nearly every item sold, so it stays quick). On phones it rises from the bottom edge instead, where the thumb is.
 * Reduced motion keeps the fade and drops the movement.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          className={cn(
            "fixed inset-0 z-40 bg-navy/40 transition-opacity duration-180 ease-out-strong",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-140",
          )}
        />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden border-2 border-navy bg-paper text-navy outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
            "md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(92vw,36rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:pb-0",
            "transition-[opacity,transform,translate,scale] duration-180 ease-out-strong",
            "data-ending-style:duration-140",
            "max-md:data-starting-style:translate-y-full max-md:data-ending-style:translate-y-full",
            "md:data-starting-style:scale-[0.96] md:data-starting-style:opacity-0 md:data-ending-style:scale-[0.96] md:data-ending-style:opacity-0",
            "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:opacity-0",
            "motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-ending-style:opacity-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-navy/10 px-5 pt-5 pb-4">
            <div>
              <BaseDialog.Title className="font-display text-2xl font-extrabold leading-tight">
                {title}
              </BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-0.5 text-sm text-navy/60">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-navy/15 text-xl transition-transform duration-160 ease-out-strong hover:bg-navy/5 active:scale-[0.97]"
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
