/**
 * Renders the iOS launch screens (public/splash/*.png): cream background with the app icon
 * centred, matching the in-app LaunchSplash so the hand-off is seamless.
 *
 *   pnpm --filter web assets:splash
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SPLASH_ICON_SCALE, SPLASH_SCREENS } from "../src/lib/splash-screens";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/splash");
const CREAM = "#f8f1e6";

const icon = await readFile(path.join(root, "assets/source/icon.svg"));

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await Promise.all(
  SPLASH_SCREENS.map(async ({ file, pixelWidth, pixelHeight }) => {
    const size = Math.round(Math.min(pixelWidth, pixelHeight) * SPLASH_ICON_SCALE);
    const iconPng = await sharp(icon, { density: (72 * size) / 512 })
      .resize(size, size)
      .png()
      .toBuffer();
    await sharp({ create: { width: pixelWidth, height: pixelHeight, channels: 3, background: CREAM } })
      .composite([
        { input: iconPng, left: Math.round((pixelWidth - size) / 2), top: Math.round((pixelHeight - size) / 2) },
      ])
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(out, file));
  }),
);

console.log(`${SPLASH_SCREENS.length} launch screens written to public/splash`);
