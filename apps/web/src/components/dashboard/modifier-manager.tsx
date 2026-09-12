"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Panel, SectionTag } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/client";
import { formatK, mediaUrl } from "@/lib/format";
import type { MenuModifier } from "@/lib/services/menu";
import { ActiveBadge, ConfirmButton, ImageUpload, PageHeader } from "./common";

type ModifierType = "SEASONING" | "ADDON" | "UPGRADE";
type Draft = {
  id?: string;
  name: string;
  type: ModifierType;
  price: string;
  imageKey: string | null;
  appliesTo: "" | "FRIES" | "CHICKEN";
  isActive: boolean;
  sortOrder: string;
};

const GROUPS: { type: ModifierType; title: string; icon: string; hint: string; folder: string }[] = [
  { type: "SEASONING", title: "Free seasonings", icon: "🧂", hint: "Customers pick up to 2, free.", folder: "seasoning" },
  { type: "ADDON", title: "Add-ons", icon: "➕", hint: "Paid extras on top of any size.", folder: "addon" },
  { type: "UPGRADE", title: "Upgrades", icon: "⭐", hint: "Swap the cut, e.g. Pom-Pom +3K.", folder: "menu" },
];

export function ModifierManager({ modifiers: initial }: { modifiers: MenuModifier[] }) {
  const { data, mutate } = useSWR<{ modifiers: MenuModifier[] }>("/api/admin/modifiers", {
    fallbackData: { modifiers: initial },
  });
  const modifiers = data?.modifiers ?? initial;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  function open(type: ModifierType, m?: MenuModifier) {
    setDraft(
      m
        ? {
            id: m.id,
            name: m.name,
            type: m.type,
            price: String(m.price),
            imageKey: m.imageKey,
            appliesTo: m.appliesTo ?? "",
            isActive: m.isActive,
            sortOrder: String(m.sortOrder),
          }
        : { name: "", type, price: type === "SEASONING" ? "0" : "", imageKey: null, appliesTo: "", isActive: true, sortOrder: "0" },
    );
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api(draft.id ? `/api/admin/modifiers/${draft.id}` : "/api/admin/modifiers", {
        method: draft.id ? "PATCH" : "POST",
        body: {
          name: draft.name,
          type: draft.type,
          price: Number(draft.price.replace(/\D/g, "")) || 0,
          imageKey: draft.imageKey,
          appliesTo: draft.appliesTo || null,
          isActive: draft.isActive,
          sortOrder: Number(draft.sortOrder) || 0,
        },
      });
      toast.success(draft.id ? "Saved" : "Added");
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
      await api(`/api/admin/modifiers/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const group = GROUPS.find((g) => g.type === draft?.type);

  return (
    <>
      <PageHeader title="Seasonings & add-ons" description="Everything a cashier can put on top of a size." />
      <div className="flex flex-col gap-5">
        {GROUPS.map((g) => {
          const items = modifiers.filter((m) => m.type === g.type);
          return (
            <Panel key={g.type} className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <SectionTag icon={g.icon}>{g.title}</SectionTag>
                  <p className="mt-1 text-sm font-semibold text-navy/55">{g.hint}</p>
                </div>
                <Button intent="outline" size="sm" onClick={() => open(g.type)}>
                  + Add
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => open(g.type, m)}
                    className="flex flex-col items-center gap-1 rounded-2xl border-2 border-navy/15 bg-white p-3 text-center transition-[border-color,transform] duration-160 ease-out-strong hover:border-navy active:scale-[0.97]"
                  >
                    <span className="relative h-16 w-full">
                      {m.imageKey && (
                        <Image src={mediaUrl(m.imageKey)!} alt="" fill sizes="160px" className="object-contain mix-blend-multiply" />
                      )}
                    </span>
                    <span className="font-display leading-tight font-extrabold">{m.name}</span>
                    <span className="text-xs font-bold text-navy/55">
                      {m.price ? `+${formatK(m.price)}` : "Free"}
                      {m.appliesTo && ` · ${m.appliesTo === "FRIES" ? "Fries only" : "Chicken only"}`}
                    </span>
                    <ActiveBadge active={m.isActive} />
                  </button>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? `Edit ${draft.name}` : `New ${group?.title.toLowerCase().replace(/s$/, "") ?? "item"}`}
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
          <div className="flex flex-col gap-4">
            <ImageUpload value={draft.imageKey} onChange={(imageKey) => setDraft({ ...draft, imageKey })} folder={group?.folder ?? "uploads"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
              </Field>
              <Field label="Type">
                <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ModifierType })}>
                  <option value="SEASONING">Free seasoning</option>
                  <option value="ADDON">Add-on</option>
                  <option value="UPGRADE">Upgrade</option>
                </Select>
              </Field>
              <Field label="Price (Rp)" hint={draft.type === "SEASONING" ? "Seasonings are usually free (0)." : undefined}>
                <Input
                  inputMode="numeric"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <Field label="Available for">
                <Select
                  value={draft.appliesTo}
                  onChange={(e) => setDraft({ ...draft, appliesTo: e.target.value as Draft["appliesTo"] })}
                >
                  <option value="">Every product</option>
                  <option value="FRIES">Fries only</option>
                  <option value="CHICKEN">Chicken only</option>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Sort order" className="w-28">
                <Input
                  inputMode="numeric"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value.replace(/[^\d-]/g, "") })}
                />
              </Field>
              <Checkbox
                label="Show on the register"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
