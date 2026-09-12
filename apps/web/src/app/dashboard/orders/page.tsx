import type { Metadata } from "next";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { jakartaDateKey, startOfJakartaDay } from "@/lib/format";
import { listOrders } from "@/lib/services/orders";
import { toOrderView } from "@/lib/views";

export const metadata: Metadata = { title: "Orders" };

type Search = { from?: string; to?: string; status?: string; q?: string };

const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function DashboardOrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const from = isDay(params.from) ?? jakartaDateKey(startOfJakartaDay(new Date(), -6));
  const to = isDay(params.to) ?? jakartaDateKey();
  const status =
    params.status === "PENDING" || params.status === "PAID" || params.status === "CANCELLED"
      ? params.status
      : undefined;

  const orders = await listOrders({
    from: startOfJakartaDay(new Date(`${from}T12:00:00+07:00`)),
    to: startOfJakartaDay(new Date(`${to}T12:00:00+07:00`), 1),
    status,
    q: params.q?.trim() || undefined,
    take: 500,
  });

  return (
    <OrdersTable
      orders={orders.map(toOrderView)}
      filters={{ from, to, status: status ?? "", q: params.q ?? "" }}
    />
  );
}
