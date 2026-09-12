"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartModifier = { id: string; name: string; type: string; price: number };

export type CartLine = {
  key: string;
  productId: string;
  productName: string;
  imageKey: string | null;
  variantId: string;
  size: string;
  grams: number;
  modifiers: CartModifier[];
  unitPrice: number; // display only — the server reprices every order
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  customerName: string;
  voucherCode: string | null;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  setCustomerName: (name: string) => void;
  setVoucherCode: (code: string | null) => void;
  clear: () => void;
  restore: (lines: CartLine[], customerName: string) => void;
};

const lineKey = (variantId: string, modifiers: CartModifier[]) =>
  [variantId, ...modifiers.map((m) => m.id).sort()].join("|");

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      customerName: "",
      voucherCode: null,
      add: (line) =>
        set((state) => {
          const key = lineKey(line.variantId, line.modifiers);
          const existing = state.lines.find((l) => l.key === key);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.key === key ? { ...l, quantity: Math.min(l.quantity + line.quantity, 50) } : l,
              ),
            };
          }
          return { lines: [...state.lines, { ...line, key }] };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, 50) } : l)),
        })),
      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      setCustomerName: (customerName) => set({ customerName }),
      setVoucherCode: (voucherCode) => set({ voucherCode: voucherCode?.trim().toUpperCase() || null }),
      clear: () => set({ lines: [], customerName: "", voucherCode: null }),
      restore: (lines, customerName) => set({ lines, customerName }),
    }),
    { name: "potatoni-cart" },
  ),
);

export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);
