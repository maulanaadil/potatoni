import "server-only";
import { db } from "../db";

export async function getMenu({ includeInactive = false } = {}) {
  const where = includeInactive ? {} : { isActive: true };
  const [products, modifiers] = await Promise.all([
    db.product.findMany({
      where,
      include: { variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.modifier.findMany({
      where,
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return { products, modifiers };
}

export type Menu = Awaited<ReturnType<typeof getMenu>>;
export type MenuProduct = Menu["products"][number];
export type MenuModifier = Menu["modifiers"][number];
