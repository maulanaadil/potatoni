import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { type Category, type ModifierType, PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Straight off the menu board. Image keys match scripts/upload-assets.ts.
const products: {
  name: string;
  slug: string;
  category: Category;
  tagline: string;
  imageKey: string;
  variants: { size: string; grams: number; price: number; isPopular?: boolean }[];
}[] = [
  {
    name: "Shoestring Fries",
    slug: "shoestring-fries",
    category: "FRIES",
    tagline: "Thin-cut and crunchy to the very last bite.",
    imageKey: "menu/shoestring.webp",
    variants: [
      { size: "S", grams: 100, price: 18000 },
      { size: "M", grams: 150, price: 22000, isPopular: true },
      { size: "L", grams: 200, price: 25000, isPopular: true },
    ],
  },
  {
    name: "Chicken Bites",
    slug: "chicken-bites",
    category: "CHICKEN",
    tagline: "Crispy chicken in bite-size pieces.",
    imageKey: "menu/chicken-bites.webp",
    variants: [
      { size: "S", grams: 120, price: 22000 },
      { size: "M", grams: 150, price: 25000 },
      { size: "L", grams: 200, price: 32000 },
    ],
  },
];

const modifiers: {
  name: string;
  type: ModifierType;
  price: number;
  imageKey: string;
  appliesTo?: Category;
}[] = [
  { name: "Pom-Pom", type: "UPGRADE", price: 3000, imageKey: "menu/pom-pom.webp", appliesTo: "FRIES" },
  { name: "Cheese", type: "SEASONING", price: 0, imageKey: "seasoning/cheese.webp" },
  { name: "BBQ", type: "SEASONING", price: 0, imageKey: "seasoning/bbq.webp" },
  { name: "Jagung Bakar", type: "SEASONING", price: 0, imageKey: "seasoning/jagung-bakar.webp" },
  { name: "Pedas", type: "SEASONING", price: 0, imageKey: "seasoning/pedas.webp" },
  { name: "Truffle", type: "ADDON", price: 2000, imageKey: "addon/truffle.webp" },
  { name: "Garlic Mayo", type: "ADDON", price: 2000, imageKey: "addon/mayo.webp" },
  { name: "Spicy Mayo", type: "ADDON", price: 2000, imageKey: "addon/mayo.webp" },
  { name: "Cheese Sauce", type: "ADDON", price: 2000, imageKey: "addon/cheese-sauce.webp" },
  { name: "Animal Style", type: "ADDON", price: 3000, imageKey: "addon/animal-style.webp" },
  {
    name: "Chicken Bites",
    type: "ADDON",
    price: 8000,
    imageKey: "addon/chicken-bites.webp",
    appliesTo: "FRIES",
  },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@potatoni.id").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Set ADMIN_PASSWORD in .env before seeding");

  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.ADMIN_NAME ?? "Owner Potatoni",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  // Optional register-only account for testing the cashier flow.
  const cashierEmail = process.env.CASHIER_EMAIL?.toLowerCase();
  const cashierPassword = process.env.CASHIER_PASSWORD;
  if (cashierEmail && cashierPassword) {
    await db.user.upsert({
      where: { email: cashierEmail },
      update: {},
      create: {
        email: cashierEmail,
        name: process.env.CASHIER_NAME ?? "Cashier Potatoni",
        role: "CASHIER",
        passwordHash: await bcrypt.hash(cashierPassword, 12),
      },
    });
  }

  for (const [index, p] of products.entries()) {
    const { variants, ...data } = p;
    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: { ...data, sortOrder: index },
      create: { ...data, sortOrder: index },
    });
    for (const [vIndex, v] of variants.entries()) {
      await db.productVariant.upsert({
        where: { productId_size: { productId: product.id, size: v.size } },
        update: { ...v, sortOrder: vIndex },
        create: { ...v, productId: product.id, sortOrder: vIndex },
      });
    }
  }

  for (const [index, m] of modifiers.entries()) {
    const existing = await db.modifier.findFirst({ where: { name: m.name, type: m.type } });
    const data = { ...m, appliesTo: m.appliesTo ?? null, sortOrder: index };
    if (existing) await db.modifier.update({ where: { id: existing.id }, data });
    else await db.modifier.create({ data });
  }

  console.log(
    `Seeded ${products.length} products, ${modifiers.length} modifiers, admin ${email}` +
      (cashierEmail && cashierPassword ? `, cashier ${cashierEmail}` : ""),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
