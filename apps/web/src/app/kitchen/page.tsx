import type { Metadata } from "next";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { startOfJakartaDay } from "@/lib/format";
import { listOrders } from "@/lib/services/orders";
import { toOrderView } from "@/lib/views";

export const metadata: Metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const orders = await listOrders({ from: startOfJakartaDay(), status: "PAID" });
  return <KitchenBoard initialOrders={orders.map(toOrderView)} />;
}
