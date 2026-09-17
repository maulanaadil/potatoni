"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { PUSH_EVENT } from "@/components/push-alerts";
import { EmptyState, Panel } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import type { OrderView } from "@/lib/views";

const DONE_KEY = "potatoni-kitchen-done";

/** Cooked orders are ticked off per device, so a second screen still sees the queue. */
function useDone() {
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}") as { day?: string; ids?: string[] };
      setDone(stored.day === new Date().toDateString() ? (stored.ids ?? []) : []);
    } catch {
      setDone([]);
    }
  }, []);

  function toggle(id: string) {
    setDone((ids) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      localStorage.setItem(DONE_KEY, JSON.stringify({ day: new Date().toDateString(), ids: next }));
      return next;
    });
  }

  return [done, toggle] as const;
}

const minutesSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0);

export function KitchenBoard({ initialOrders }: { initialOrders: OrderView[] }) {
  const { data, mutate, isValidating } = useSWR<{ orders: OrderView[] }>("/api/orders?status=PAID", {
    fallbackData: { orders: initialOrders },
    refreshInterval: 15_000,
  });
  const [done, toggleDone] = useDone();
  const [, tick] = useState(0);

  useEffect(() => {
    const refresh = () => void mutate();
    window.addEventListener(PUSH_EVENT, refresh);
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      window.removeEventListener(PUSH_EVENT, refresh);
      clearInterval(timer);
    };
  }, [mutate]);

  const orders = [...(data?.orders ?? [])].sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));
  const queue = orders.filter((o) => !done.includes(o.id));
  const finished = orders.filter((o) => done.includes(o.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none font-extrabold md:text-4xl">To cook</h1>
          <p className="mt-1.5 text-sm font-semibold text-navy-soft">
            {queue.length === 0 ? "All caught up" : `${queue.length} order${queue.length === 1 ? "" : "s"} waiting`}
            {finished.length > 0 && ` · ${finished.length} done`}
          </p>
        </div>
        <Button intent="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
          {isValidating ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {queue.length === 0 ? (
        <EmptyState title="Nothing to cook right now">
          Paid orders land here the moment the cashier confirms.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {queue.map((order) => {
            const waiting = minutesSince(order.paidAt);
            return (
              <Panel key={order.id} className="flex animate-rise flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl leading-tight font-extrabold">{order.code}</p>
                    <p className="text-sm font-semibold text-navy-soft">
                      {formatTime(order.paidAt ?? order.createdAt)}
                      {order.location && ` · ${order.location.name}`}
                      {order.customerName && ` · ${order.customerName}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tabular-nums",
                      waiting >= 10 ? "bg-tomato/15 text-tomato" : "bg-navy/10 text-navy-soft",
                    )}
                  >
                    {waiting < 1 ? "just now" : `${waiting} min`}
                  </span>
                </div>

                <ul className="flex flex-col gap-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="rounded-xl bg-cream px-3 py-2">
                      <p className="font-display font-extrabold">
                        {item.quantity}× {item.productName} <span className="text-navy-soft">{item.variantSize}</span>
                        <span className="ml-1 text-xs font-bold text-navy-soft">{item.variantGrams}g</span>
                      </p>
                      {item.modifiers.length > 0 && (
                        <p className="mt-0.5 text-sm font-semibold text-navy-soft">
                          {item.modifiers.map((m) => m.name).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                {order.note && <p className="text-sm font-bold text-tomato">📝 {order.note}</p>}

                <Button intent="sun" size="sm" className="mt-auto" onClick={() => toggleDone(order.id)}>
                  Mark cooked
                </Button>
              </Panel>
            );
          })}
        </div>
      )}

      {finished.length > 0 && (
        <details className="rounded-2xl border-2 border-navy/15 bg-paper p-3">
          <summary className="cursor-pointer font-display font-bold">Cooked today ({finished.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {finished.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span>
                  {order.code} · {formatTime(order.paidAt ?? order.createdAt)}
                </span>
                <button
                  type="button"
                  className="font-bold text-navy-soft underline"
                  onClick={() => toggleDone(order.id)}
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
