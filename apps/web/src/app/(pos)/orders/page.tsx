import type { Metadata } from "next";
import { OrdersBoard } from "@/components/pos/orders-board";
import { startOfJakartaDay } from "@/lib/format";
import { listOrders } from "@/lib/services/orders";
import { toOrderView } from "@/lib/views";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await listOrders({ from: startOfJakartaDay() });
  return <OrdersBoard initialOrders={orders.map(toOrderView)} />;
}
