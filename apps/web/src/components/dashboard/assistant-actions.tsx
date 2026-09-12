"use client";

import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { useAssistant } from "@/lib/assistant";
import type { AssistantAction } from "@/lib/assistant-types";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { formatRupiah, jakartaDateKey } from "@/lib/format";

type PurchasesAction = Extract<AssistantAction, { type: "purchases" }>;
type LocationAction = Extract<AssistantAction, { type: "location" }>;

const card = "mt-3 rounded-2xl border-2 border-navy bg-paper p-3 text-navy";
const removeButton =
  "grid size-8 shrink-0 place-items-center rounded-full text-lg text-navy-soft outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-tomato/10 hover:text-tomato focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100";

/**
 * A form the assistant filled in from a message or a photo (a receipt, an event poster).
 * Everything stays editable; nothing is saved until the owner presses Record / Add, and the
 * save goes through the normal API (same validation and activity log as the dashboard).
 */
export function ActionCard({
  messageId,
  index,
  action,
  superseded = false,
}: {
  messageId: string;
  index: number;
  action: AssistantAction;
  /** A later answer proposed the same kind of form; only that one can be saved (no double records). */
  superseded?: boolean;
}) {
  if (action.status !== "pending") return <ActionSettled action={action} />;
  if (superseded) {
    return (
      <p className="mt-3 rounded-2xl border-2 border-navy/10 px-3 py-2 text-sm font-bold text-navy-soft">
        ↓ Updated in a later answer
      </p>
    );
  }
  return action.type === "purchases" ? (
    <PurchasesCard messageId={messageId} index={index} action={action} />
  ) : (
    <LocationCard messageId={messageId} index={index} action={action} />
  );
}

function ActionSettled({ action }: { action: AssistantAction }) {
  const done = action.status === "done";
  const what =
    action.type === "purchases"
      ? `${action.items.length} purchase${action.items.length === 1 ? "" : "s"} ${done ? "recorded" : "dismissed"}`
      : `Location “${action.name}” ${done ? "added" : "dismissed"}`;
  return (
    <p
      className={cn(
        "mt-3 flex animate-fade items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-bold",
        done ? "border-leaf/30 bg-leaf/10 text-leaf" : "border-navy/10 text-navy-soft",
      )}
    >
      <span aria-hidden>{done ? "✓" : "–"}</span>
      {what}
    </p>
  );
}

type Row = { key: number; item: string; quantity: string; unit: string; total: string; supplier: string };

const rowValid = (r: Row) =>
  r.item.trim() && r.unit.trim() && Number(r.quantity.replace(",", ".")) > 0 && Number(r.total) > 0;

function PurchasesCard({ messageId, index, action }: { messageId: string; index: number; action: PurchasesAction }) {
  const setActionStatus = useAssistant((s) => s.setActionStatus);
  const [rows, setRows] = useState<Row[]>(() =>
    action.items.map((item, key) => ({
      key,
      item: item.item,
      quantity: String(item.quantity),
      unit: item.unit,
      total: String(item.total),
      supplier: item.supplier ?? "",
    })),
  );
  const [day, setDay] = useState(action.purchased_on ?? jakartaDateKey());
  const [saving, setSaving] = useState(false);
  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const total = rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const valid = rows.length > 0 && rows.every(rowValid);

  async function record() {
    setSaving(true);
    let saved = 0;
    try {
      for (const r of rows) {
        await api("/api/purchases", {
          body: {
            item: r.item.trim(),
            quantity: Number(r.quantity.replace(",", ".")),
            unit: r.unit.trim(),
            total: Number(r.total),
            supplier: r.supplier.trim() || null,
            // Noon WIB lands on the chosen Jakarta day whatever the server's timezone.
            purchasedAt: `${day}T12:00:00+07:00`,
          },
        });
        saved++;
      }
      await setActionStatus(messageId, index, "done");
      toast.success(saved === 1 ? "Purchase recorded" : `${saved} purchases recorded`);
    } catch (err) {
      // Never record the saved lines twice when the owner retries.
      if (saved) setRows((list) => list.slice(saved));
      toast.error(saved ? `${saved} saved, then: ${(err as Error).message}` : (err as Error).message);
    } finally {
      setSaving(false);
      if (saved) void mutate((key) => typeof key === "string" && key.startsWith("/api/purchases"));
    }
  }

  return (
    <section aria-label="Purchases to record" className={cn(card, "animate-rise motion-reduce:animate-fade")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-base font-extrabold">🛒 Ready to record</p>
        <div className="w-44">
          <DatePicker value={day} onChange={(v) => v && setDay(v)} max={jakartaDateKey()} />
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="@container rounded-xl border-2 border-navy/10 bg-cream/60 p-2">
            <div className="flex items-center gap-1">
              <Input
                aria-label="Item"
                value={r.item}
                onChange={(e) => update(r.key, { item: e.target.value })}
                className="h-10 min-w-0 flex-1"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${r.item}`}
                  onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                  className={removeButton}
                >
                  ×
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 @xs:grid-cols-[4.5rem_4.5rem_minmax(0,1fr)]">
              <Input
                aria-label="Quantity"
                inputMode="decimal"
                value={r.quantity}
                onChange={(e) => update(r.key, { quantity: e.target.value })}
                className="h-10 tabular-nums"
              />
              <Input
                aria-label="Unit"
                value={r.unit}
                onChange={(e) => update(r.key, { unit: e.target.value })}
                className="h-10"
              />
              <div className="col-span-2 @xs:col-span-1">
                <MoneyInput
                  aria-label="Total paid"
                  value={r.total}
                  onValueChange={(total) => update(r.key, { total })}
                  className="h-10"
                />
              </div>
            </div>
            <Input
              aria-label="Supplier"
              placeholder="Supplier (optional)"
              value={r.supplier}
              onChange={(e) => update(r.key, { supplier: e.target.value })}
              className="mt-2 h-10"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">
          Total <span className="tabular-nums">{formatRupiah(total)}</span>
        </p>
        <div className="flex gap-2">
          <Button
            intent="ghost"
            size="sm"
            disabled={saving}
            onClick={() => setActionStatus(messageId, index, "dismissed")}
          >
            Dismiss
          </Button>
          <Button intent="success" size="sm" disabled={saving || !valid} onClick={record}>
            {saving ? "Recording…" : rows.length === 1 ? "Record purchase" : `Record ${rows.length} purchases`}
          </Button>
        </div>
      </div>
    </section>
  );
}

function LocationCard({ messageId, index, action }: { messageId: string; index: number; action: LocationAction }) {
  const setActionStatus = useAssistant((s) => s.setActionStatus);
  const [form, setForm] = useState({
    name: action.name,
    address: action.address ?? "",
    notes: action.notes ?? "",
    startsOn: action.starts_on ?? "",
    endsOn: action.ends_on ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function add() {
    setSaving(true);
    try {
      await api("/api/admin/locations", {
        body: {
          name: form.name.trim(),
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
          startsOn: form.startsOn || null,
          endsOn: form.endsOn || null,
          isActive: true,
        },
      });
      await setActionStatus(messageId, index, "done");
      void mutate((key) => typeof key === "string" && /^\/api\/(admin\/)?locations/.test(key));
      toast.success(`${form.name.trim()} added to Locations`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Location to add" className={cn(card, "animate-rise motion-reduce:animate-fade")}>
      <p className="mb-2 font-display text-base font-extrabold">📍 Ready to add</p>
      <div className="flex flex-col gap-2">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="h-10" />
        </Field>
        <Field label="Address">
          <Input value={form.address} onChange={(e) => set({ address: e.target.value })} className="h-10" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts">
            <DatePicker value={form.startsOn} onChange={(startsOn) => set({ startsOn })} clearable />
          </Field>
          <Field label="Ends">
            <DatePicker
              value={form.endsOn}
              onChange={(endsOn) => set({ endsOn })}
              min={form.startsOn || undefined}
              clearable
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} className="min-h-16" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          intent="ghost"
          size="sm"
          disabled={saving}
          onClick={() => setActionStatus(messageId, index, "dismissed")}
        >
          Dismiss
        </Button>
        <Button intent="success" size="sm" disabled={saving || !form.name.trim()} onClick={add}>
          {saving ? "Adding…" : "Add location"}
        </Button>
      </div>
    </section>
  );
}
