import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { productInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };
const include = { variants: { orderBy: { sortOrder: "asc" as const } } };

export const GET = handler(async (_request, { params }: Ctx) => {
  await requireApiSession("ADMIN");
  const { id } = await params;
  const product = await db.product.findUniqueOrThrow({ where: { id }, include });
  return NextResponse.json({ product });
});

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const { variants, ...data } = await parseBody(request, productInput);

  // Order items keep their own snapshots, so replacing variants is safe.
  const product = await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data });
    await tx.productVariant.deleteMany({
      where: { productId: id, size: { notIn: variants.map((v) => v.size) } },
    });
    for (const [i, v] of variants.entries()) {
      await tx.productVariant.upsert({
        where: { productId_size: { productId: id, size: v.size } },
        update: { ...v, sortOrder: i },
        create: { ...v, sortOrder: i, productId: id },
      });
    }
    return tx.product.findUniqueOrThrow({ where: { id }, include });
  });

  await logActivity({
    action: "product.updated",
    message: `${session.name} updated product ${product.name}`,
    source: "DASHBOARD",
    session,
    entityType: "product",
    entityId: id,
  });
  return NextResponse.json({ product });
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const product = await db.product.delete({ where: { id } });
  await logActivity({
    action: "product.deleted",
    message: `${session.name} deleted product ${product.name}`,
    source: "DASHBOARD",
    session,
    entityType: "product",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
});
