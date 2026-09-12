"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel, SectionTag } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { api } from "@/lib/client";
import { formatRupiah, formatTime } from "@/lib/format";
import type { PurchaseView } from "@/lib/views";
import { useCurrentLocation } from "./location-context";

// One tap fills the most common stock runs.
const PRESETS = [
  { item: "Frozen potatoes", unit: "kg" },
  { item: "Chicken", unit: "kg" },
  { item: "Cooking oil", unit: "L" },
  { item: "Seasoning powder", unit: "pack" },
  { item: "Paper boats", unit: "pcs" },
  { item: "Gas", unit: "tube" },
];

const empty = { item: "", quantity: "", unit: "kg", total: "", supplier: "", note: "" };

export function PurchaseBook({ initialPurchases }: { initialPurchases: PurchaseView[] }) {
  const { data, mutate } = useSWR<{ purchases: PurchaseView[] }>("/api/purchases", {
    fallbackData: { purchases: initialPurchases },
  });
  const purchases = data?.purchases ?? [];
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { locationId, location } = useCurrentLocation();

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { purchase } = await api<{ purchase: PurchaseView }>("/api/purchases", {
        body: {
          locationId,
          item: form.item,
          quantity: Number(form.quantity.replace(",", ".")),
          unit: form.unit,
          total: Number(form.total.replace(/\D/g, "")),
          supplier: form.supplier || undefined,
          note: form.note || undefined,
        },
      });
      void mutate({ purchases: [purchase, ...purchases] }, { revalidate: false });
      setForm(empty);
      toast.success(`Saved: ${purchase.item} (${formatRupiah(purchase.total)})`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const totalToday = purchases.reduce((s, p) => s + p.total, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-start">
      <Panel className="p-4 lg:sticky lg:top-24">
        <SectionTag icon="🛒">Buy stock</SectionTag>
        <p className="mt-2 text-sm font-semibold text-navy-soft">
          Record every purchase so the owner can see today&apos;s real profit{location ? ` at ${location.name}` : ""}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.item}
              type="button"
              onClick={() => setForm((f) => ({ ...f, item: p.item, unit: p.unit }))}
              className="rounded-full border-2 border-navy/15 bg-cream px-3 py-1 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-sun/70 pointer-coarse:min-h-11 transition-[border-color,transform] duration-160 ease-out-strong hover:border-navy active:scale-[0.97]"
            >
              {p.item}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Field label="Item">
            <Input
              value={form.item}
              onChange={set("item")}
              placeholder="e.g. Frozen potatoes"
              required
              maxLength={80}
            />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Quantity">
              <Input value={form.quantity} onChange={set("quantity")} inputMode="decimal" placeholder="5" required />
            </Field>
            <Field label="Unit">
              <Input value={form.unit} onChange={set("unit")} required maxLength={16} />
            </Field>
          </div>
          <Field label="Total paid">
            <MoneyInput
              value={form.total}
              onValueChange={(total) => setForm((f) => ({ ...f, total }))}
              placeholder="150.000"
              required
            />
          </Field>
          <Field label="Supplier (optional)">
            <Input value={form.supplier} onChange={set("supplier")} placeholder="Pasar Kosambi" maxLength={80} />
          </Field>
          <Field label="Note (optional)">
            <Input value={form.note} onChange={set("note")} maxLength={200} />
          </Field>
          <Button type="submit" intent="sun" size="lg" disabled={saving}>
            {saving ? "Saving…" : "Save purchase"}
          </Button>
        </form>
      </Panel>

      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h1 className="font-display text-3xl font-extrabold leading-none">Today&apos;s purchases</h1>
          <p className="font-display text-xl font-extrabold tabular-nums">{formatRupiah(totalToday)}</p>
        </div>
        {purchases.length === 0 ? (
          <EmptyState title="Nothing bought today">Purchases you record show up here.</EmptyState>
        ) : (
          <Panel className="divide-y-2 divide-dotted divide-navy/15">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {p.item}{" "}
                    <span className="text-navy-soft">
                      · {p.quantity} {p.unit}
                    </span>
                  </p>
                  <p className="truncate text-xs font-semibold text-navy-soft">
                    {formatTime(p.purchasedAt)}
                    {p.supplier && ` · ${p.supplier}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <span className="shrink-0 font-display text-lg font-extrabold tabular-nums">
                  {formatRupiah(p.total)}
                </span>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}
