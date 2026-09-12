import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { getMenu } from "@/lib/services/menu";
import { productInput } from "@/lib/validators";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "product";
  let slug = base;
  for (let i = 2; await db.product.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  const { products } = await getMenu({ includeInactive: true });
  return NextResponse.json({ products });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const { variants, ...data } = await parseBody(request, productInput);
  const product = await db.product.create({
    data: {
      ...data,
      slug: await uniqueSlug(data.name),
      variants: { create: variants.map((v, i) => ({ ...v, sortOrder: i })) },
    },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  await logActivity({
    action: "product.created",
    message: `${session.name} added product ${product.name}`,
    source: "DASHBOARD",
    session,
    entityType: "product",
    entityId: product.id,
  });
  return NextResponse.json({ product }, { status: 201 });
});
