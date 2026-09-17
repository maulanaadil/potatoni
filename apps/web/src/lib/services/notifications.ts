import "server-only";
import { formatRupiah } from "../format";
import { type PushPayload, sendToRoles } from "../push";
import type { OrderWithItems } from "./orders";

const itemLine = (item: OrderWithItems["items"][number]) => {
  const modifiers = (item.modifiers as { name: string }[] | null) ?? [];
  const extras = modifiers.map((m) => m.name).join(", ");
  return `${item.quantity}× ${item.productName} ${item.variantSize}${extras ? ` — ${extras}` : ""}`;
};

function kitchenPayload(order: OrderWithItems): PushPayload {
  const lines = order.items.map(itemLine);
  if (order.note) lines.push(`📝 ${order.note}`);
  return {
    title: `🍟 Cook ${order.code}`,
    body: lines.join("\n"),
    url: "/kitchen",
    tag: `order-${order.id}`,
  };
}

function frontPayload(order: OrderWithItems): PushPayload {
  const where = order.location ? ` · ${order.location.name}` : "";
  const who = order.customerName ? ` · ${order.customerName}` : "";
  return {
    title: `💸 ${order.code} paid`,
    body: `${formatRupiah(order.total)} · ${order.paymentMethod === "QRIS" ? "QRIS" : "Cash"}${where}${who}`,
    url: "/orders",
    tag: `order-${order.id}`,
  };
}

/**
 * Payment confirmed: the front of house gets the money, the kitchen gets what to cook.
 * Never throws — a failed notification must not fail the payment.
 */
export async function notifyOrderPaid(order: OrderWithItems) {
  await Promise.all([
    sendToRoles(["ADMIN", "CASHIER"], frontPayload(order)),
    sendToRoles(["KITCHEN"], kitchenPayload(order)),
  ]).catch((err) => console.error("push: order paid", err));
}
