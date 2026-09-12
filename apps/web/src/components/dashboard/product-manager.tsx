"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel, PriceRow } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { api } from "@/lib/client";
import { mediaUrl } from "@/lib/format";
import type { MenuProduct } from "@/lib/services/menu";
import { ActiveBadge, ConfirmButton, ImageUpload, PageHeader } from "./common";

type VariantDraft = { size: string; grams: string; price: string; isPopular: boolean };
type Draft = {
  id?: string;
  name: string;
  category: "FRIES" | "CHICKEN";
  tagline: string;
  imageKey: string | null;
  isActive: boolean;
  sortOrder: string;
  variants: VariantDraft[];
};

const blank: Draft = {
  name: "",
  category: "FRIES",
  tagline: "",
  imageKey: null,
  isActive: true,
  sortOrder: "0",
  variants: [
    { size: "S", grams: "100", price: "", isPopular: false },
    { size: "M", grams: "150", price: "", isPopular: false },
    { size: "L", grams: "200", price: "", isPopular: false },
  ],
};

function toDraft(p: MenuProduct): Draft {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    tagline: p.tagline ?? "",
    imageKey: p.imageKey,
    isActive: p.isActive,
    sortOrder: String(p.sortOrder),
    variants: p.variants.map((v) => ({
      size: v.size,
      grams: String(v.grams),
      price: String(v.price),
      isPopular: v.isPopular,
    })),
  };
}

export function ProductManager({ products: initial }: { products: MenuProduct[] }) {
  const { data, mutate } = useSWR<{ products: MenuProduct[] }>("/api/admin/products", {
    fallbackData: { products: initial },
  });
  const products = data?.products ?? initial;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        name: draft.name,
        category: draft.category,
        tagline: draft.tagline,
        imageKey: draft.imageKey,
        isActive: draft.isActive,
        sortOrder: Number(draft.sortOrder) || 0,
        variants: draft.variants.map((v) => ({
          size: v.size,
          grams: Number(v.grams),
          price: Number(v.price.replace(/\D/g, "")),
          isPopular: v.isPopular,
        })),
      };
      await api(draft.id ? `/api/admin/products/${draft.id}` : "/api/admin/products", {
        method: draft.id ? "PATCH" : "POST",
        body,
      });
      toast.success(draft.id ? "Product updated" : "Product added");
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
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
      toast.success("Product deleted");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const setVariant = (i: number, patch: Partial<VariantDraft>) =>
    setDraft((d) => d && { ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  return (
    <>
      <PageHeader
        title="Products"
        description="What the register sells. Sales history keeps its own copy, so edits never change past orders."
        actions={
          <Button intent="sun" onClick={() => setDraft(blank)}>
            + New product
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState title="No products yet">Add Shoestring Fries, Chicken Bites and friends.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <Panel key={p.id} className="flex flex-col gap-3 p-4">
              <div className="relative aspect-[2/1] rounded-2xl bg-cream">
                {p.imageKey && (
                  <Image src={mediaUrl(p.imageKey)!} alt={p.name} fill sizes="400px" className="object-contain mix-blend-multiply" />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl leading-tight font-extrabold">{p.name}</p>
                  <p className="text-xs font-bold text-navy-soft uppercase">{p.category === "FRIES" ? "Fries" : "Chicken"}</p>
                </div>
                <ActiveBadge active={p.isActive} />
              </div>
              <div className="flex flex-col gap-1">
                {p.variants.map((v) => (
                  <PriceRow key={v.id} size={v.size} grams={v.grams} price={v.price} popular={v.isPopular} />
                ))}
              </div>
              <Button intent="outline" size="sm" className="mt-auto" onClick={() => setDraft(toDraft(p))}>
                Edit
              </Button>
            </Panel>
          ))}
        </div>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        title={draft?.id ? "Edit product" : "New product"}
        footer={
          <div className="flex justify-between gap-2">
            {draft?.id ? (
              <ConfirmButton onConfirm={() => remove(draft.id!)}>Delete</ConfirmButton>
            ) : (
              <span />
            )}
            <Button intent="sun" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save product"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <ImageUpload value={draft.imageKey} onChange={(imageKey) => setDraft({ ...draft, imageKey })} folder="menu" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
              </Field>
              <Field label="Category">
                <Select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as Draft["category"] })}
                >
                  <option value="FRIES">Fries</option>
                  <option value="CHICKEN">Chicken</option>
                </Select>
              </Field>
            </div>
            <Field label="Tagline">
              <Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} maxLength={120} />
            </Field>

            <div>
              <p className="mb-2 text-sm font-bold">Sizes & prices</p>
              <div className="flex flex-col gap-2">
                {draft.variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-[3.5rem_1fr_1.4fr_auto] items-center gap-2">
                    <Input aria-label="Size" value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} maxLength={4} />
                    <Input
                      aria-label="Grams"
                      inputMode="numeric"
                      placeholder="grams"
                      value={v.grams}
                      onChange={(e) => setVariant(i, { grams: e.target.value.replace(/\D/g, "") })}
                    />
                    <MoneyInput aria-label="Price" placeholder="Price" value={v.price} onValueChange={(price) => setVariant(i, { price })} />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Best seller"
                        aria-pressed={v.isPopular}
                        onClick={() => setVariant(i, { isPopular: !v.isPopular })}
                        className={cn(
                          "grid size-11 place-items-center rounded-lg text-2xl outline-none transition-transform duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]",
                          v.isPopular ? "text-sun" : "text-navy/25",
                        )}
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        aria-label="Remove size"
                        disabled={draft.variants.length === 1}
                        onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })}
                        className="grid size-11 place-items-center rounded-lg text-lg text-tomato outline-none transition-transform duration-160 ease-out-strong hover:bg-tomato/10 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:opacity-30"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                intent="ghost"
                size="sm"
                className="mt-2"
                onClick={() =>
                  setDraft({ ...draft, variants: [...draft.variants, { size: "", grams: "", price: "", isPopular: false }] })
                }
              >
                + Add size
              </Button>
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
