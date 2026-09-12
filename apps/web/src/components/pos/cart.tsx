"use client";

import { Drawer } from "@base-ui/react/drawer";
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/cn";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Panel, Sparkles } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cartCount, cartTotal, useCart } from "@/lib/cart";
import { api } from "@/lib/client";
import { formatRupiah } from "@/lib/format";
import type { OrderView } from "@/lib/views";
import { useCurrentLocation } from "./location-context";
import { PaymentDialog } from "./payment-dialog";
import { QuantityStepper } from "./quantity-stepper";

const rupiahFormat = { style: "currency", currency: "IDR", maximumFractionDigits: 0 } as const;
// The total changes on every add, so the roll stays inside the 200ms UI budget (default is 900ms).
const numberTiming = {
  transformTiming: { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  spinTiming: { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  opacityTiming: { duration: 150, easing: "ease-out" },
} as const;

// The cart lives in localStorage; render it only after hydration to avoid a mismatch.
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function CartPanel({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const { lines, customerName, setCustomerName, setQuantity, clear, restore } = useCart();
  const { locationId } = useCurrentLocation();
  const [paymentMethod, setPaymentMethod] = useState<"QRIS" | "CASH">("QRIS");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderView | null>(null);

  const visibleLines = hydrated ? lines : [];
  const total = cartTotal(visibleLines);

  async function checkout() {
    setSubmitting(true);
    try {
      const { order } = await api<{ order: OrderView }>("/api/orders", {
        body: {
          paymentMethod,
          // Send what the location bar shows, so the cashier always sees where the sale lands.
          locationId,
          customerName: customerName || undefined,
          items: lines.map((l) => ({
            variantId: l.variantId,
            modifierIds: l.modifiers.map((m) => m.id),
            quantity: l.quantity,
          })),
        },
      });
      setOrder(order);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between border-b-2 border-navy/10 px-4 py-3">
        <h2 className="font-display text-xl font-extrabold">Current order</h2>
        {visibleLines.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const snapshot = { lines, customerName };
              clear();
              // One tap wipes the whole order, so make it forgiving.
              toast("Order cleared", { action: { label: "Undo", onClick: () => restore(snapshot.lines, snapshot.customerName) } });
            }}
            className="h-11 rounded-lg px-3 text-sm font-bold text-tomato outline-none transition-colors duration-150 hover:bg-tomato/10 focus-visible:ring-4 focus-visible:ring-sun/70"
          >
            Clear
          </button>
        )}
      </div>

      <div className="max-h-[45dvh] flex-1 overflow-y-auto overscroll-contain px-4 lg:max-h-[calc(100dvh-26rem)]">
        {visibleLines.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <Sparkles className="h-8 text-navy-soft/50" />
            <p className="font-display text-lg font-bold">Nothing here yet</p>
            <p className="text-sm text-navy-soft">Pick a size from the menu to start.</p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-dotted divide-navy/15">
            {visibleLines.map((line) => (
              <li
                key={line.key}
                className="flex items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base leading-tight font-extrabold">
                    {line.productName} <span className="text-navy-soft">{line.size}</span>
                  </p>
                  {line.modifiers.length > 0 && (
                    <p className="truncate text-xs font-semibold text-navy-soft">
                      {line.modifiers.map((m) => m.name).join(" · ")}
                    </p>
                  )}
                  <p className="text-sm font-bold tabular-nums">{formatRupiah(line.unitPrice * line.quantity)}</p>
                </div>
                <QuantityStepper value={line.quantity} onChange={(q) => setQuantity(line.key, q)} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t-2 border-navy/10 bg-cream/60 px-4 py-4">
        <Input
          placeholder="Customer name (optional)"
          value={hydrated ? customerName : ""}
          onChange={(e) => setCustomerName(e.target.value)}
          maxLength={60}
        />
        <div className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-navy bg-paper p-1" role="radiogroup">
          {(["QRIS", "CASH"] as const).map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={paymentMethod === method}
              onClick={() => setPaymentMethod(method)}
              className={cn(
                "h-11 rounded-xl font-display font-bold outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]",
                paymentMethod === method ? "bg-navy text-cream" : "hover:bg-navy/5",
              )}
            >
              {method === "QRIS" ? "QRIS" : "Cash"}
            </button>
          ))}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg font-bold">Total</span>
          <NumberFlow
            value={total}
            locales="id-ID"
            format={rupiahFormat}
            {...numberTiming}
            className="font-display text-3xl font-extrabold tabular-nums"
          />
        </div>
        <Button
          intent="sun"
          size="lg"
          disabled={visibleLines.length === 0 || submitting}
          onClick={checkout}
        >
          {submitting ? "Creating order…" : `Charge ${formatRupiah(total)}`}
        </Button>
      </div>

      <PaymentDialog
        order={order}
        onClose={() => setOrder(null)}
        onSettled={(status) => {
          // A cancelled order keeps the cart so the cashier can fix it and charge again.
          if (status === "PAID") clear();
        }}
      />
    </Panel>
  );
}

/** Phones and portrait tablets: a bottom bar that opens the cart as a swipeable sheet. */
export function CartDrawer() {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const count = hydrated ? cartCount(lines) : 0;
  const total = hydrated ? cartTotal(lines) : 0;

  return (
    <Drawer.Root>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-navy bg-cream/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <Drawer.Trigger
          disabled={count === 0}
          className="flex h-14 w-full items-center justify-between rounded-2xl border-2 border-navy bg-sun px-5 font-display text-lg font-extrabold transition-[transform,opacity] duration-160 ease-out-strong active:scale-[0.98] disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            <span className="grid h-8 min-w-8 place-items-center rounded-full bg-navy px-2 text-base text-cream tabular-nums">
              {count}
            </span>
            {count === 0 ? "Cart is empty" : "View order"}
          </span>
          <NumberFlow value={total} locales="id-ID" format={rupiahFormat} {...numberTiming} className="tabular-nums" />
        </Drawer.Trigger>
      </div>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-navy opacity-[calc(0.4*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-drawer data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup className="-mb-12 w-full max-w-2xl overflow-hidden rounded-t-3xl border-2 border-b-0 border-navy bg-paper pb-12 outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-drawer data-swiping:select-none data-starting-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:[transform:none] motion-reduce:data-ending-style:[transform:none]">
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-navy/20" />
            <Drawer.Title className="sr-only">Current order</Drawer.Title>
            <Drawer.Content>
              <CartPanel className="rounded-none border-0 pb-[env(safe-area-inset-bottom)]" />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
