/**
 * Crops product/brand images out of the menu board and uploads them, plus
 * the QRIS sticker, to the S3 bucket. Keys match prisma/seed.ts.
 *
 *   pnpm assets:upload            # crop + upload
 *   pnpm assets:upload --dry-run  # crop into .context/asset-preview only
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { cutoutFromMenu, LOGO_CROP, LOGO_ERASE, MENU } from "./cutout";

const root = path.resolve(import.meta.dirname, "..");
const QRIS = path.join(root, "assets/source/qris.jpg");

type Crop = { key: string; left: number; top: number; width: number; height: number };

// Coordinates are in menu-board.png pixels (1054×1492).
const CROPS: Crop[] = [
  { key: "brand/logo.webp", ...LOGO_CROP },
  { key: "menu/shoestring.webp", left: 505, top: 342, width: 520, height: 218 },
  { key: "menu/pom-pom.webp", left: 525, top: 600, width: 495, height: 200 },
  { key: "menu/chicken-bites.webp", left: 478, top: 818, width: 540, height: 252 },
  { key: "seasoning/cheese.webp", left: 412, top: 1098, width: 130, height: 72 },
  { key: "seasoning/bbq.webp", left: 566, top: 1098, width: 130, height: 72 },
  { key: "seasoning/jagung-bakar.webp", left: 722, top: 1098, width: 130, height: 72 },
  { key: "seasoning/pedas.webp", left: 878, top: 1098, width: 130, height: 72 },
  // Bowls stop above the navy "+2K" price badges.
  { key: "addon/truffle.webp", left: 62, top: 1326, width: 130, height: 66 },
  { key: "addon/mayo.webp", left: 252, top: 1328, width: 130, height: 64 },
  { key: "addon/cheese-sauce.webp", left: 438, top: 1326, width: 130, height: 66 },
  { key: "addon/animal-style.webp", left: 612, top: 1326, width: 144, height: 66 },
  { key: "addon/chicken-bites.webp", left: 812, top: 1290, width: 184, height: 102 },
];

const dryRun = process.argv.includes("--dry-run");
const previewDir = path.resolve(root, "../../.context/asset-preview");

async function build() {
  const files: { key: string; body: Buffer; contentType: string }[] = [];
  for (const c of CROPS) {
    const { key, ...crop } = c;
    const png = await cutoutFromMenu(crop, key === "brand/logo.webp" ? LOGO_ERASE : []);
    files.push({
      key,
      body: await sharp(png).webp({ quality: 88, alphaQuality: 90 }).toBuffer(),
      contentType: "image/webp",
    });
  }
  files.push({
    key: "brand/menu-board.webp",
    body: await sharp(MENU).webp({ quality: 85 }).toBuffer(),
    contentType: "image/webp",
  });
  files.push({ key: "payment/qris.jpg", body: await readFile(QRIS), contentType: "image/jpeg" });
  return files;
}

async function main() {
  const files = await build();

  if (dryRun) {
    for (const f of files) {
      const out = path.join(previewDir, f.key);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, f.body);
    }
    console.log(`Wrote ${files.length} files to ${previewDir}`);
    return;
  }

  const s3 = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  for (const f of files) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: f.key,
        Body: f.body,
        ContentType: f.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    console.log(`↑ ${f.key} (${Math.round(f.body.length / 1024)} KB)`);
  }

  const listed = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET }));
  console.log(`\nBucket ${process.env.S3_BUCKET} now holds ${listed.KeyCount ?? 0} objects:`);
  for (const o of listed.Contents ?? []) {
    console.log(`  ${o.Key} (${Math.round((o.Size ?? 0) / 1024)} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
