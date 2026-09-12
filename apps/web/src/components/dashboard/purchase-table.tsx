"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/client";
import { formatDateTime, formatRupiah, jakartaDateKey } from "@/lib/format";
import type { PurchaseView } from "@/lib/views";
import { ConfirmButton, PageHeader } from "./common";

type Filters = { from: string; to: string; location: string };
type LocationOption = { id: string; name: string; isActive: boolean };
type Draft = {
  id?: string;
  item: string;
  quantity: string;
  unit: string;
  total: string;
  supplier: string;
  note: string;
  date: string;
  locationId: string; // "" = no location
};

const toQuery = (f: Filters) => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

export function PurchaseTable({
  purchases: initial,
  filters,
  locations,
  scheduledId,
}: {
  purchases: PurchaseView[];
  filters: Filters;
  locations: LocationOption[];
  scheduledId: string | null;
}) {
  const [form, setForm] = useState(filters);
  const [applied, setApplied] = useState(filters);
  const isInitial = toQuery(applied) === toQuery(filters);
  const { data, mutate } = useSWR<{ purchases: PurchaseView[] }>(`/api/purchases?${toQuery(applied)}`, {
    fallbackData: isInitial ? { purchases: initial } : undefined,
  });
  const purchases = data?.purchases ?? [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const total = purchases.reduce((s, p) => s + p.total, 0);

  const blank = (): Draft => ({
    item: "",
    quantity: "",
    unit: "kg",
    total: "",
    supplier: "",
    note: "",
    date: jakartaDateKey(),
    locationId: scheduledId ?? "",
  });

  function apply(e: FormEvent) {
    e.preventDefault();
    setApplied(form);
    window.history.replaceState(null, "", `/dashboard/purchases?${toQuery(form)}`);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api(draft.id ? `/api/purchases/${draft.id}` : "/api/purchases", {
        method: draft.id ? "PATCH" : "POST",
        body: {
          item: draft.item,
          quantity: Number(draft.quantity.replace(",", ".")),
          unit: draft.unit,
          total: Number(draft.total.replace(/\D/g, "")),
          supplier: draft.supplier,
          note: draft.note,
          locationId: draft.locationId || null,
          // Noon WIB keeps the purchase on the chosen calendar day.
          purchasedAt: new Date(`${draft.date}T12:00:00+07:00`).toISOString(),
        },
      });
      toast.success("Purchase saved");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/purchases/${id}`, { method: "DELETE" });
      toast.success("Purchase deleted");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Purchases"
        description={`${purchases.length} purchases · ${formatRupiah(total)} spent`}
        actions={
          <Button intent="sun" onClick={() => setDraft(blank())}>
            + Record purchase
          </Button>
        }
      />
      <Panel className="mb-4 p-4">
        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
          <Field label="From">
            <DatePicker value={form.from} onChange={(v) => setForm({ ...form, from: v })} />
          </Field>
          <Field label="To">
            <DatePicker min={form.from} value={form.to} onChange={(v) => setForm({ ...form, to: v })} />
          </Field>
          <Field label="Location">
            <Select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value="none">No location</option>
            </Select>
          </Field>
          <Button type="submit">Apply</Button>
        </form>
      </Panel>

      {purchases.length === 0 ? (
        <EmptyState title="No purchases match these filters" />
      ) : (
        <Panel className="divide-y-2 divide-navy/10 overflow-hidden">
          {purchases.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setDraft({
                  id: p.id,
                  item: p.item,
                  quantity: String(p.quantity),
                  unit: p.unit,
                  total: String(p.total),
                  supplier: p.supplier ?? "",
                  note: p.note ?? "",
                  date: jakartaDateKey(new Date(p.purchasedAt)),
                  locationId: p.location?.id ?? "",
                })
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-cream focus-visible:bg-cream"
            >
              <div className="min-w-0">
                <p className="font-bold">
                  {p.item} <span className="text-navy-soft">· {p.quantity} {p.unit}</span>
                </p>
                <p className="truncate text-xs font-semibold text-navy-soft">
                  {formatDateTime(p.purchasedAt)}
                  {p.location && ` · 📍 ${p.location.name}`}
                  {p.supplier && ` · ${p.supplier}`}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <span className="shrink-0 font-display text-lg font-extrabold tabular-nums">{formatRupiah(p.total)}</span>
            </button>
          ))}
        </Panel>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit purchase" : "Record purchase"}
        footer={
          <div className="flex justify-between gap-2">
            {draft?.id ? <ConfirmButton onConfirm={() => remove(draft.id!)}>Delete</ConfirmButton> : <span />}
            <Button intent="sun" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item" className="sm:col-span-2">
              <Input value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Quantity">
              <Input inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
            </Field>
            <Field label="Unit">
              <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} maxLength={16} />
            </Field>
            <Field label="Total paid">
              <MoneyInput value={draft.total} onValueChange={(total) => setDraft({ ...draft, total })} placeholder="150.000" />
            </Field>
            <Field label="Date">
              <DatePicker value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} />
            </Field>
            <Field label="Location" className="sm:col-span-2">
              <Select value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}>
                <option value="">No location</option>
                {locations
                  .filter((l) => l.isActive || l.id === draft.locationId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Supplier">
              <Input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Note">
              <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={200} />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
