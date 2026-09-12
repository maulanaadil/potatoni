import type { Metadata } from "next";
import { ProductManager } from "@/components/dashboard/product-manager";
import { getMenu } from "@/lib/services/menu";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const { products } = await getMenu({ includeInactive: true });
  return <ProductManager products={products} />;
}
