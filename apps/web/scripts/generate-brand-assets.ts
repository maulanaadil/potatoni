/**
 * Builds the <head> assets from the brand sources:
 *   src/app/favicon.ico, src/app/icon.svg, src/app/apple-icon.png
 *   public/icons/icon-{192,512}.png, public/icons/icon-maskable-512.png (web manifest)
 *   src/app/opengraph-image.jpg + twitter-image.jpg (link previews, 1200×630)
 *
 *   pnpm --filter web assets:brand
 */
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { cutoutFromMenu, LOGO_CROP, LOGO_ERASE } from "./cutout";

const root = path.resolve(import.meta.dirname, "..");
const app = path.join(root, "src/app");
const icons = path.join(root, "public/icons");
const CREAM = "#f8f1e6";
const NAVY = "#2a2670";

const svg = await readFile(path.join(root, "assets/source/icon.svg"), "utf8");
// Full-bleed square for iOS and Android masks (they round the corners themselves).
const squareSvg = svg.replace(/<rect width="512" height="512" rx="116"/, '<rect width="512" height="512"');
// Maskable icons need the artwork inside the central 80% safe zone.
const maskableSvg = squareSvg.replace(/<rect width="512" height="512" fill="#2a2670"\/>\n  <g /, '<rect width="512" height="512" fill="#2a2670"/>\n  <g transform="translate(51.2 51.2) scale(0.8)"><g ')
  .replace(/<\/svg>\s*$/, "</g></svg>\n");

const png = (source: string, size: number) =>
  sharp(Buffer.from(source), { density: Math.max(72, (72 * size) / 512 * 4) }).resize(size, size).png().toBuffer();

/** ICO container with PNG-encoded entries (supported by every current browser). */
function toIco(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

async function icons_() {
  await mkdir(icons, { recursive: true });
  const ico = toIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(svg, size) }))));
  await writeFile(path.join(app, "favicon.ico"), ico);
  await writeFile(path.join(app, "icon.svg"), svg);
  await writeFile(path.join(app, "apple-icon.png"), await png(squareSvg, 180));
  await writeFile(path.join(icons, "icon-192.png"), await png(svg, 192));
  await writeFile(path.join(icons, "icon-512.png"), await png(svg, 512));
  await writeFile(path.join(icons, "icon-maskable-512.png"), await png(maskableSvg, 512));
}

async function shareImage() {
  const W = 1200;
  const H = 630;
  const [logo, shoestring, chicken] = await Promise.all([
    cutoutFromMenu(LOGO_CROP, LOGO_ERASE), // same art as brand/logo.webp
    cutoutFromMenu({ left: 505, top: 342, width: 520, height: 218 }),
    cutoutFromMenu({ left: 478, top: 818, width: 540, height: 252 }),
  ]);
  const fit = (buf: Buffer, width: number) => sharp(buf).resize({ width }).png().toBuffer();
  const logoImg = await fit(logo, 560);
  const logoMeta = await sharp(logoImg).metadata();

  // Menu-board frame + sparkles, no text (the logo already carries the tagline).
  const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="44" fill="none" stroke="${NAVY}" stroke-width="6"/>
    <g fill="none" stroke-width="5" stroke-linejoin="round">
      <path d="M92 70c2.4 14 6.4 18 19 20-12.6 2-16.6 6-19 20-2.4-14-6.4-18-19-20 12.6-2 16.6-6 19-20Z" stroke="${NAVY}"/>
      <path d="M150 58c1.6 9 4 11.6 12 13-8 1.4-10.4 4-12 13-1.6-9-4-11.6-12-13 8-1.4 10.4-4 12-13Z" stroke="#ffc62b"/>
      <path d="M1104 512c2.4 14 6.4 18 19 20-12.6 2-16.6 6-19 20-2.4-14-6.4-18-19-20 12.6-2 16.6-6 19-20Z" stroke="${NAVY}"/>
    </g>
  </svg>`);

  const image = await sharp({ create: { width: W, height: H, channels: 4, background: CREAM } })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: logoImg, left: 56, top: Math.round((H - (logoMeta.height ?? 340)) / 2) },
      // Two boats stacked on the right, each fully visible.
      { input: await fit(shoestring, 470), left: 668, top: 58 },
      { input: await fit(chicken, 450), left: 680, top: 318 },
    ])
    // JPEG keeps link previews light (WhatsApp skips heavy images).
    .flatten({ background: CREAM })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  await Promise.all([
    rm(path.join(app, "opengraph-image.png"), { force: true }),
    rm(path.join(app, "twitter-image.png"), { force: true }),
  ]);
  await writeFile(path.join(app, "opengraph-image.jpg"), image);
  await copyFile(path.join(app, "opengraph-image.jpg"), path.join(app, "twitter-image.jpg"));
  const alt = "Potatoni — crispy outside, happy inside. Shoestring fries and chicken bites in Potatoni paper boats.";
  await writeFile(path.join(app, "opengraph-image.alt.txt"), alt);
  await writeFile(path.join(app, "twitter-image.alt.txt"), alt);
}

await Promise.all([icons_(), shareImage()]);
console.log("Brand assets written to src/app and public/icons");
