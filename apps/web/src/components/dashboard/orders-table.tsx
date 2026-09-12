"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel, StatusBadge } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/client";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { OrderView } from "@/lib/views";
import { ConfirmButton, PageHeader } from "./common";

type Filters = { from: string; to: string; status: string; q: string };

const toQuery = (f: Filters) => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

export function OrdersTable({ orders: initial, filters }: { orders: OrderView[]; filters: Filters }) {
  const [form, setForm] = useState(filters);
  const [applied, setApplied] = useState(filters);
  const key = `/api/admin/orders?take=500&${toQuery(applied)}`;
  const isInitial = toQuery(applied) === toQuery(filters);
  const { data, mutate, isValidating } = useSWR<{ orders: OrderView[] }>(key, {
    fallbackData: isInitial ? { orders: initial } : undefined,
  });
  const orders = data?.orders ?? [];
  const [selected, setSelected] = useState<OrderView | null>(null);

  const paid = orders.filter((o) => o.status === "PAID");
  const revenue = paid.reduce((s, o) => s + o.total, 0);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setApplied(form);
    // Keep the URL shareable without a server round-trip; SWR fetches the new key.
    window.history.replaceState(null, "", `/dashboard/orders?${toQuery(form)}`);
  }

  async function update(order: OrderView, status: "PAID" | "CANCELLED") {
    try {
      const { order: updated } = await api<{ order: OrderView }>(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: { status },
      });
      toast.success(`${updated.code} ${status === "PAID" ? "marked as paid" : "cancelled"}`);
      setSelected(updated);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(order: OrderView) {
    try {
      await api(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      toast.success(`${order.code} deleted`);
      setSelected(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${isValidating ? "Loading… · " : ""}${orders.length} orders · ${paid.length} paid · ${formatRupiah(revenue)} revenue`}
      />

      <Panel className="mb-4 p-4">
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.5fr_auto] lg:items-end">
          <Field label="From">
            <Input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="PENDING">Awaiting payment</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </Field>
          <Field label="Search">
            <Input
              placeholder="Order code or customer"
              value={form.q}
              onChange={(e) => setForm({ ...form, q: e.target.value })}
            />
          </Field>
          <Button type="submit">Apply</Button>
        </form>
      </Panel>

      {orders.length === 0 ? (
        <EmptyState title="No orders match these filters" />
      ) : (
        <Panel className="overflow-hidden">
          {/* Cards on phones, table from md up */}
          <ul className="divide-y-2 divide-navy/10 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSelected(o)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-cream"
                >
                  <div className="min-w-0">
                    <p className="font-display font-extrabold">{o.code}</p>
                    <p className="truncate text-xs font-semibold text-navy/55">
                      {formatDateTime(o.createdAt)} · {o.paymentMethod}
                      {o.customerName && ` · ${o.customerName}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold tabular-nums">{formatRupiah(o.total)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="border-b-2 border-navy bg-cream-deep/60 font-display text-xs tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-navy/10">
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-cream"
                >
                  <td className="px-4 py-3 font-display font-extrabold">
                    {o.code}
                    {o.customerName && <span className="block text-xs font-semibold text-navy/55">{o.customerName}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                  <td className="max-w-64 truncate px-4 py-3">
                    {o.items.map((i) => `${i.quantity}× ${i.productName} ${i.variantSize}`).join(", ")}
                  </td>
                  <td className="px-4 py-3">{o.paymentMethod === "QRIS" ? "QRIS" : "Cash"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{formatRupiah(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.code ?? ""}
        description={selected ? formatDateTime(selected.createdAt) : undefined}
        footer={
          selected && (
            <div className="flex flex-wrap justify-end gap-2">
              <ConfirmButton onConfirm={() => remove(selected)} confirmLabel="Tap again to delete forever">
                Delete
              </ConfirmButton>
              {selected.status !== "CANCELLED" && (
                <ConfirmButton onConfirm={() => update(selected, "CANCELLED")}>Cancel order</ConfirmButton>
              )}
              {selected.status === "PENDING" && (
                <Button intent="success" size="sm" onClick={() => update(selected, "PAID")}>
                  Mark as paid
                </Button>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <StatusBadge status={selected.status} />
              <span className="text-sm font-bold text-navy/60">
                {selected.paymentMethod === "QRIS" ? "QRIS" : "Cash"}
                {selected.paidAt && ` · paid ${formatDateTime(selected.paidAt)}`}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {selected.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 rounded-xl bg-cream px-3 py-2">
                  <span>
                    <span className="font-bold">
                      {item.quantity}× {item.productName} {item.variantSize}
                    </span>{" "}
                    <span className="text-navy/55">({item.variantGrams}g)</span>
                    {item.modifiers.length > 0 && (
                      <span className="block text-xs text-navy/60">
                        {item.modifiers.map((m) => `${m.name}${m.price ? ` +${m.price / 1000}K` : ""}`).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="font-bold tabular-nums">{formatRupiah(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t-2 border-dotted border-navy/20 pt-3 font-display text-xl font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(selected.total)}</span>
            </div>
            {selected.cashReceived != null && (
              <p className="text-sm text-navy/60">
                Cash received {formatRupiah(selected.cashReceived)} · change{" "}
                {formatRupiah(selected.cashReceived - selected.total)}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
