"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useCart } from "@/lib/cart";
import { formatK, formatRupiah, mediaUrl } from "@/lib/format";
import type { MenuModifier, MenuProduct } from "@/lib/services/menu";
import { MAX_SEASONINGS } from "@/lib/validators";
import { QuantityStepper } from "./quantity-stepper";

const tile =
  "relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-center transition-[background-color,border-color,transform,opacity] duration-160 ease-out-strong active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";

export function ProductOptionsDialog({
  product,
  initialVariantId,
  modifiers,
  onClose,
}: {
  product: MenuProduct | null;
  initialVariantId: string | null;
  modifiers: MenuModifier[];
  onClose: () => void;
}) {
  const add = useCart((s) => s.add);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [upgradeId, setUpgradeId] = useState<string | null>(null);
  const [seasoningIds, setSeasoningIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  // Keep the last product rendered while the dialog animates out.
  const [shown, setShown] = useState<MenuProduct | null>(null);

  useEffect(() => {
    if (!product) return;
    setShown(product);
    setVariantId(initialVariantId);
    setUpgradeId(null);
    setSeasoningIds([]);
    setAddonIds([]);
    setQuantity(1);
  }, [product, initialVariantId]);

  const applicable = useMemo(
    () =>
      shown
        ? modifiers.filter((m) => !m.appliesTo || m.appliesTo === shown.category)
        : [],
    [modifiers, shown],
  );
  const upgrades = applicable.filter((m) => m.type === "UPGRADE");
  const seasonings = applicable.filter((m) => m.type === "SEASONING");
  const addons = applicable.filter((m) => m.type === "ADDON");

  const variant = shown?.variants.find((v) => v.id === variantId) ?? null;
  const chosen = applicable.filter(
    (m) => m.id === upgradeId || seasoningIds.includes(m.id) || addonIds.includes(m.id),
  );
  const unitPrice = (variant?.price ?? 0) + chosen.reduce((s, m) => s + m.price, 0);

  function toggleSeasoning(id: string) {
    setSeasoningIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_SEASONINGS ? ids : [...ids, id],
    );
  }

  function submit() {
    if (!shown || !variant) return;
    add({
      productId: shown.id,
      productName: shown.name,
      imageKey: shown.imageKey,
      variantId: variant.id,
      size: variant.size,
      grams: variant.grams,
      modifiers: chosen.map((m) => ({ id: m.id, name: m.name, type: m.type, price: m.price })),
      unitPrice,
      quantity,
    });
    onClose();
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
      title={shown?.name ?? ""}
      description={shown?.tagline}
      footer={
        <div className="flex items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} />
          <Button intent="sun" size="lg" className="flex-1" disabled={!variant} onClick={submit}>
            Add · {formatRupiah(unitPrice * quantity)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <OptionGroup title="Size">
          <div className="grid grid-cols-3 gap-2">
            {shown?.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === variantId}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  tile,
                  "py-3",
                  v.id === variantId ? "border-navy bg-sun" : "border-navy/15 bg-white hover:border-navy/40",
                )}
              >
                <span className="font-display text-3xl leading-none font-extrabold">{v.size}</span>
                <span className="text-xs font-bold text-navy/60">{v.grams}g</span>
                <span className="font-display text-lg font-extrabold">{formatK(v.price)}</span>
                {v.isPopular && <span className="absolute top-1 right-2 text-sun">★</span>}
              </button>
            ))}
          </div>
        </OptionGroup>

        {upgrades.length > 0 && shown && (
          <OptionGroup title="Cut">
            <div className="grid grid-cols-2 gap-2">
              <ImageTile
                label={shown.name.replace(/ fries$/i, "")}
                imageKey={shown.imageKey}
                selected={upgradeId === null}
                onClick={() => setUpgradeId(null)}
              />
              {upgrades.map((u) => (
                <ImageTile
                  key={u.id}
                  label={u.name}
                  price={u.price}
                  imageKey={u.imageKey}
                  selected={upgradeId === u.id}
                  onClick={() => setUpgradeId(u.id)}
                />
              ))}
            </div>
          </OptionGroup>
        )}

        {seasonings.length > 0 && (
          <OptionGroup title="Free seasonings" hint={`${seasoningIds.length}/${MAX_SEASONINGS} picked`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {seasonings.map((s) => (
                <ImageTile
                  key={s.id}
                  label={s.name}
                  imageKey={s.imageKey}
                  selected={seasoningIds.includes(s.id)}
                  disabled={!seasoningIds.includes(s.id) && seasoningIds.length >= MAX_SEASONINGS}
                  onClick={() => toggleSeasoning(s.id)}
                />
              ))}
            </div>
          </OptionGroup>
        )}

        {addons.length > 0 && (
          <OptionGroup title="Add-ons">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {addons.map((a) => (
                <ImageTile
                  key={a.id}
                  label={a.name}
                  price={a.price}
                  imageKey={a.imageKey}
                  selected={addonIds.includes(a.id)}
                  onClick={() =>
                    setAddonIds((ids) => (ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id]))
                  }
                />
              ))}
            </div>
          </OptionGroup>
        )}
      </div>
    </Dialog>
  );
}

function OptionGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-lg font-extrabold uppercase">{title}</h3>
        {hint && <span className="text-sm font-bold text-navy/55">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function ImageTile({
  label,
  price,
  imageKey,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  price?: number;
  imageKey: string | null;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(tile, selected ? "border-navy bg-sun/70" : "border-navy/15 bg-white hover:border-navy/40")}
    >
      <span className="relative h-14 w-full">
        {imageKey && (
          <Image src={mediaUrl(imageKey)!} alt="" fill sizes="160px" className="object-contain mix-blend-multiply" />
        )}
      </span>
      <span className="text-sm leading-tight font-extrabold">{label}</span>
      {price ? <span className="text-xs font-bold text-navy/60">+{formatK(price)}</span> : null}
      {selected && (
        <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-navy text-[11px] text-cream">
          ✓
        </span>
      )}
    </button>
  );
}
