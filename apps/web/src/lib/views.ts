import type { ModifierSnapshot, OrderWithItems } from "./services/orders";

/** JSON-safe order shape shared by server pages, API responses and client components. */
export type OrderView = {
  id: string;
  code: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  paymentMethod: "QRIS" | "CASH";
  subtotal: number;
  total: number;
  cashReceived: number | null;
  customerName: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  location: { id: string; name: string } | null;
  discount: number;
  voucherClaim: { code: string | null; campaign: { name: string } } | null;
  items: {
    id: string;
    productName: string;
    variantSize: string;
    variantGrams: number;
    modifiers: ModifierSnapshot[];
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
};

export function toOrderView(order: OrderWithItems): OrderView {
  return JSON.parse(JSON.stringify(order)) as OrderView;
}

export type PurchaseView = {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  total: number;
  supplier: string | null;
  note: string | null;
  purchasedAt: string;
  location: { id: string; name: string } | null;
};
