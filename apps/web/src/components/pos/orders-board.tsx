"use client";

import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel, StatusBadge } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatTime } from "@/lib/format";
import type { OrderView } from "@/lib/views";
import { PaymentDialog } from "./payment-dialog";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Awaiting payment" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export function OrdersBoard({ initialOrders }: { initialOrders: OrderView[] }) {
  // Other tills can create orders too, so poll while this screen is open.
  const { data, mutate, isValidating, error } = useSWR<{ orders: OrderView[] }>("/api/orders", {
    fallbackData: { orders: initialOrders },
    refreshInterval: 15_000,
  });
  const orders = data?.orders ?? [];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ALL");
  const [active, setActive] = useState<OrderView | null>(null);

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  const visible = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);
  const paid = orders.filter((o) => o.status === "PAID");
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  function replace(order: OrderView) {
    void mutate({ orders: orders.map((o) => (o.id === order.id ? order : o)) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-none md:text-4xl">Today&apos;s orders</h1>
          <p className="mt-1 text-sm font-semibold text-navy-soft">
            {paid.length} paid · {formatRupiah(paid.reduce((s, o) => s + o.total, 0))}
            {pendingCount > 0 && ` · ${pendingCount} awaiting payment`}
          </p>
        </div>
        <Button intent="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
          {isValidating ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "shrink-0 rounded-full border-2 border-navy px-4 py-1.5 font-display text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-sun/70 pointer-coarse:min-h-11 transition-[background-color,color,transform] duration-160 ease-out-strong active:scale-[0.97]",
              filter === f.value ? "bg-navy text-cream" : "bg-paper hover:bg-cream-deep",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No orders here">New orders from the register show up in this list.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <Panel key={order.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg leading-tight font-extrabold">{order.code}</p>
                  <p className="text-sm font-semibold text-navy-soft">
                    {formatTime(order.createdAt)} · {order.paymentMethod === "QRIS" ? "QRIS" : "Cash"}
                    {order.location && ` · ${order.location.name}`}
                    {order.customerName && ` · ${order.customerName}`}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <ul className="flex flex-col gap-0.5 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="min-w-0">
                      {item.quantity}× {item.productName} {item.variantSize}
                      {item.modifiers.length > 0 && (
                        <span className="block truncate text-xs text-navy-soft">
                          {item.modifiers.map((m) => m.name).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{formatRupiah(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {order.discount > 0 && (
                <p className="flex justify-between text-sm font-bold text-leaf">
                  <span>🎟️ {order.voucherClaim?.code ?? "Voucher"}</span>
                  <span className="tabular-nums">−{formatRupiah(order.discount)}</span>
                </p>
              )}
              <div className="mt-auto flex items-center justify-between border-t-2 border-dotted border-navy/15 pt-3">
                <span className="font-display text-xl font-extrabold tabular-nums">{formatRupiah(order.total)}</span>
                {order.status === "PENDING" && (
                  <Button intent="sun" size="sm" onClick={() => setActive(order)}>
                    Take payment
                  </Button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <PaymentDialog order={active} onClose={() => setActive(null)} onSettled={(_status, order) => replace(order)} />
    </div>
  );
}
