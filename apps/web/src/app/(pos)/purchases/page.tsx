import type { Metadata } from "next";
import { PurchaseBook } from "@/components/pos/purchase-book";
import { db } from "@/lib/db";
import { startOfJakartaDay } from "@/lib/format";
import type { PurchaseView } from "@/lib/views";

export const metadata: Metadata = { title: "Purchases" };
export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const purchases = await db.purchase.findMany({
    where: { purchasedAt: { gte: startOfJakartaDay() } },
    orderBy: { purchasedAt: "desc" },
  });
  return <PurchaseBook initialPurchases={JSON.parse(JSON.stringify(purchases)) as PurchaseView[]} />;
}
