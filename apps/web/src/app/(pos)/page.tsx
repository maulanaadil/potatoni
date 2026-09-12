import type { Metadata } from "next";
import { Register } from "@/components/pos/register";
import { getMenu } from "@/lib/services/menu";

export const metadata: Metadata = { title: "Register" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { products, modifiers } = await getMenu();
  return <Register products={products} modifiers={modifiers} />;
}
