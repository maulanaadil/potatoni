"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import { useState } from "react";
import useSWR from "swr";
import { Panel, PriceRow, SectionTag, Sparkles, EmptyState } from "@/components/ui/brand";
import { formatK, mediaUrl } from "@/lib/format";
import type { MenuModifier, MenuProduct } from "@/lib/services/menu";
import { CartDrawer, CartPanel } from "./cart";
import { ProductOptionsDialog } from "./product-options-dialog";

const CATEGORY_ICON = { FRIES: "🍟", CHICKEN: "🐔" } as const;

export function Register({
  products: initialProducts,
  modifiers: initialModifiers,
}: {
  products: MenuProduct[];
  modifiers: MenuModifier[];
}) {
  // Menu edits from the dashboard reach the till when it regains focus.
  const { data } = useSWR<{ products: MenuProduct[]; modifiers: MenuModifier[] }>("/api/menu", {
    fallbackData: { products: initialProducts, modifiers: initialModifiers },
  });
  const products = data?.products ?? initialProducts;
  const modifiers = data?.modifiers ?? initialModifiers;
  const [picking, setPicking] = useState<{ product: MenuProduct; variantId: string } | null>(null);

  const upgrades = (p: MenuProduct) =>
    modifiers.filter((m) => m.type === "UPGRADE" && (!m.appliesTo || m.appliesTo === p.category));

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-none md:text-4xl">New order</h1>
            <p className="mt-1 text-sm font-semibold text-navy/60">Tap a size to add it to the order.</p>
          </div>
          <Sparkles className="hidden h-10 text-navy sm:block" />
        </div>

        {products.length === 0 && (
          <EmptyState title="No menu items yet">Add products from the dashboard to start selling.</EmptyState>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <Panel key={product.id} className="flex flex-col overflow-hidden p-4">
              <SectionTag icon={CATEGORY_ICON[product.category]}>{product.name}</SectionTag>
              <div className="relative mt-3 aspect-[2/1] w-full">
                {product.imageKey && (
                  <Image
                    src={mediaUrl(product.imageKey)!}
                    alt={product.name}
                    fill
                    sizes="(min-width: 768px) 40vw, 90vw"
                    className="object-contain mix-blend-multiply"
                  />
                )}
              </div>
              {product.tagline && (
                <p className="mt-1 text-sm font-semibold text-navy/60">{product.tagline}</p>
              )}
              <div className="mt-3 flex flex-col gap-1.5">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setPicking({ product, variantId: variant.id })}
                    className="rounded-xl border-2 border-transparent px-2 py-1.5 text-left transition-[background-color,border-color,transform] duration-160 ease-out-strong hover:border-navy/15 hover:bg-cream active:scale-[0.98] active:bg-sun/40"
                  >
                    <PriceRow
                      size={variant.size}
                      grams={variant.grams}
                      price={variant.price}
                      popular={variant.isPopular}
                    />
                  </button>
                ))}
              </div>
              {upgrades(product).map((u) => (
                <p
                  key={u.id}
                  className="mt-3 flex items-center justify-between rounded-2xl border-2 border-dashed border-navy/40 px-3 py-2 font-display text-sm font-bold uppercase"
                >
                  Upgrade to {u.name}
                  <span className="grid h-8 min-w-12 place-items-center rounded-full bg-navy px-2 text-cream">
                    +{formatK(u.price)}
                  </span>
                </p>
              ))}
            </Panel>
          ))}
        </div>

        <SeasoningStrip modifiers={modifiers} />
      </div>

      <aside className="sticky top-24 hidden lg:block">
        <CartPanel />
      </aside>

      <CartDrawer />

      <ProductOptionsDialog
        product={picking?.product ?? null}
        initialVariantId={picking?.variantId ?? null}
        modifiers={modifiers}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}

function SeasoningStrip({ modifiers }: { modifiers: MenuModifier[] }) {
  const seasonings = modifiers.filter((m) => m.type === "SEASONING");
  const addons = modifiers.filter((m) => m.type === "ADDON");
  if (!seasonings.length && !addons.length) return null;

  return (
    <Panel className="grid gap-4 p-4 md:grid-cols-2">
      {[
        { title: "Free · pick 2 seasonings", items: seasonings },
        { title: "Add-ons", items: addons },
      ].map((group) => (
        <div key={group.title}>
          <p className="font-display text-lg font-extrabold uppercase">{group.title}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {group.items.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-full border-2 border-navy/15 bg-cream px-3 py-1 text-sm font-bold",
                )}
              >
                {m.name}
                {m.price > 0 && <span className="ml-1 text-navy/55">+{formatK(m.price)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Panel>
  );
}
