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
import sharp from "sharp";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(import.meta.dirname, "..");
const MENU = path.join(root, "assets/source/menu-board.png");
const QRIS = path.join(root, "assets/source/qris.jpg");

type Crop = { key: string; left: number; top: number; width: number; height: number };

// Coordinates are in menu-board.png pixels (1054×1492).
const CROPS: Crop[] = [
  { key: "brand/logo.webp", left: 525, top: 0, width: 460, height: 290 },
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

/**
 * Knocks out the cream menu-board background: flood-fills from the edges over
 * pixels close to the border colour, feathers the rim, then trims.
 * Flooding from the edges (instead of keying every cream pixel) keeps the white
 * paper liners inside the fry boats intact.
 */
async function cutout(input: Buffer) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x: number, y: number) => (y * w + x) * 4;

  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(px(x, 0), px(x, h - 1));
  for (let y = 0; y < h; y++) border.push(px(0, y), px(w - 1, y));
  const bg = [0, 1, 2].map((c) => {
    const values = border.map((i) => data[i + c]!).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)]!;
  });
  const dist = (i: number) =>
    Math.hypot(data[i]! - bg[0]!, data[i + 1]! - bg[1]!, data[i + 2]! - bg[2]!);

  const HARD = 16; // definitely background
  const SOFT = 34; // feathered edge
  const state = new Uint8Array(w * h); // 1 = background
  const stack = border.map((i) => i / 4).filter((p) => dist(p * 4) < HARD);
  for (const p of stack) state[p] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (!state[n] && dist(n * 4) < HARD) {
        state[n] = 1;
        stack.push(n);
      }
    }
  }

  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (state[p]) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    const touchesBg =
      (x > 0 && state[p - 1]) || (x < w - 1 && state[p + 1]) || (y > 0 && state[p - w]) || (y < h - 1 && state[p + w]);
    if (touchesBg) {
      const d = dist(i);
      if (d < SOFT) data[i + 3] = Math.round(((d - HARD) / (SOFT - HARD)) * 255);
    }
  }

  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .webp({ quality: 88, alphaQuality: 90 })
    .toBuffer();
}

async function build() {
  const files: { key: string; body: Buffer; contentType: string }[] = [];
  for (const c of CROPS) {
    const crop = await sharp(MENU)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .png()
      .toBuffer();
    files.push({ key: c.key, body: await cutout(crop), contentType: "image/webp" });
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
