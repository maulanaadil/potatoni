"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** For dialogs opened ~100×/day (product options): opacity only, no travel. */
  instant?: boolean;
};

const closeButton =
  "grid size-11 shrink-0 place-items-center rounded-full border-2 border-navy/15 text-xl outline-none transition-transform duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]";

/**
 * Phones get a swipeable bottom sheet (Base UI Drawer, same physics as the cart sheet);
 * tablets and laptops get a centered modal. Both keep inputs in the scrolling body and
 * buttons in a footer, so the software keyboard never hides the field being typed in.
 */
export function Dialog(props: DialogProps) {
  const wide = useMediaQuery("(min-width: 48rem)");
  return wide ? <ModalDialog {...props} /> : <SheetDialog {...props} />;
}

/** md+: centered, opacity + scale(0.96), 180ms in / 140ms out; reduced motion = fade only. */
function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  instant = false,
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        {/* forceRender: still dims when opened from inside another sheet (payment over the cart). */}
        <BaseDialog.Backdrop
          forceRender
          className={cn(
            "fixed inset-0 z-50 bg-navy/40 transition-opacity ease-out-strong",
            instant ? "duration-100" : "duration-180 data-ending-style:duration-140",
            "data-starting-style:opacity-0 data-ending-style:opacity-0",
          )}
        />
        <BaseDialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border-2 border-navy bg-paper text-navy outline-none",
            "transition-[opacity,scale] ease-out-strong data-starting-style:opacity-0 data-ending-style:opacity-0",
            instant
              ? "duration-100"
              : "duration-180 data-ending-style:duration-140 motion-safe:data-starting-style:scale-[0.96] motion-safe:data-ending-style:scale-[0.96]",
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-navy/10 px-5 pt-5 pb-4">
            <div>
              <BaseDialog.Title className="font-display text-2xl leading-tight font-extrabold">
                {title}
              </BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="mt-0.5 text-sm text-navy-soft">{description}</BaseDialog.Description>
              )}
            </div>
            <BaseDialog.Close aria-label="Close" className={closeButton}>
              ×
            </BaseDialog.Close>
          </div>
          {/* min-h-0 lets the body shrink and scroll so the footer stays on screen */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && <div className="shrink-0 border-t-2 border-navy/10 bg-cream/60 px-5 py-4">{footer}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

// Shared with the cart sheet (pos/cart.tsx) so every phone sheet moves the same way.
export const sheetBackdropClass =
  "fixed inset-0 z-50 bg-navy opacity-[calc(0.4*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-drawer data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]";

export const sheetPopupClass = cn(
  "relative -mb-12 flex max-h-[calc(92dvh+3rem)] w-full flex-col overflow-hidden rounded-t-3xl border-2 border-b-0 border-navy bg-paper pb-12 text-navy outline-none",
  "[transform:translateY(var(--drawer-swipe-movement-y))] data-swiping:select-none",
  // A sheet opened on top (payment over the cart) dims the one underneath.
  "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:bg-transparent after:content-[''] after:transition-colors after:duration-[450ms] after:ease-drawer data-nested-drawer-open:after:bg-navy/15",
  // Reduced motion: fade in place, no travel.
  "motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:[transform:none] motion-reduce:data-ending-style:[transform:none]",
);

const sheetSlide =
  "transition-transform duration-[450ms] ease-drawer data-starting-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]";
// Instant: fade in place, but a swipe still carries the sheet down and out.
const sheetInstant =
  "transition-[transform,opacity] duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 data-swipe-dismiss:data-ending-style:opacity-100 data-swipe-dismiss:data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-swipe-dismiss:data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]";

export const sheetHandle = <div aria-hidden className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-navy/20" />;

/** < md: bottom sheet with a drag handle; swipe down (or tap the backdrop / ×) to close. */
function SheetDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  instant = false,
}: DialogProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop forceRender className={cn(sheetBackdropClass, instant && "duration-100")} />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup className={cn(sheetPopupClass, instant ? sheetInstant : sheetSlide, className)}>
              {sheetHandle}
              {/* Header is the drag zone; the body scrolls and hosts every input. */}
              <div className="flex shrink-0 touch-none items-start justify-between gap-4 border-b-2 border-navy/10 px-5 pt-3 pb-4 select-none">
                <div>
                  <Drawer.Title className="font-display text-2xl leading-tight font-extrabold">{title}</Drawer.Title>
                  {description && (
                    <Drawer.Description className="mt-0.5 text-sm text-navy-soft">{description}</Drawer.Description>
                  )}
                </div>
                <Drawer.Close aria-label="Close" className={closeButton}>
                  ×
                </Drawer.Close>
              </div>
              <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-5 py-4">
                {children}
              </Drawer.Content>
              {footer ? (
                <div className="shrink-0 border-t-2 border-navy/10 bg-cream/60 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  {footer}
                </div>
              ) : (
                <div aria-hidden className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
              )}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
