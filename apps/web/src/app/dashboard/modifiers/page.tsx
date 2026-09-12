import type { Metadata } from "next";
import { ModifierManager } from "@/components/dashboard/modifier-manager";
import { getMenu } from "@/lib/services/menu";

export const metadata: Metadata = { title: "Seasonings & add-ons" };

export default async function ModifiersPage() {
  const { modifiers } = await getMenu({ includeInactive: true });
  return <ModifierManager modifiers={modifiers} />;
}
