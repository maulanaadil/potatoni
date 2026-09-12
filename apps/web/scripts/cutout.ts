import path from "node:path";
import sharp from "sharp";

export const MENU = path.resolve(import.meta.dirname, "../assets/source/menu-board.png");

export type Crop = { left: number; top: number; width: number; height: number };

/**
 * Knocks out the cream menu-board background: flood-fills from the edges over
 * pixels close to the border colour, feathers the rim, then trims.
 * Flooding from the edges (instead of keying every cream pixel) keeps the white
 * paper liners inside the fry boats intact.
 */
export async function cutout(input: Buffer) {
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
    .png()
    .toBuffer();
}

/**
 * Crop a region of the menu board and remove its background (PNG with alpha).
 * `erase` (crop-local rectangles) paints neighbouring artwork that can't be cropped
 * around with the background colour first, so it disappears with the background.
 */
export async function cutoutFromMenu(crop: Crop, erase: Crop[] = []) {
  let image = sharp(MENU).extract(crop);
  if (erase.length) {
    const { data } = await sharp(MENU).extract({ left: crop.left, top: crop.top, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    const background = { r: data[0]!, g: data[1]!, b: data[2]!, alpha: 1 };
    const patches = await Promise.all(
      erase.map(async (r) => ({
        input: await sharp({ create: { width: r.width, height: r.height, channels: 4, background } }).png().toBuffer(),
        left: r.left,
        top: r.top,
      })),
    );
    image = sharp(await image.png().toBuffer()).composite(patches);
  }
  return cutout(await image.png().toBuffer());
}

/** The Potatoni wordmark + mascot, shared by the S3 logo and the share image. */
export const LOGO_CROP: Crop = { left: 540, top: 0, width: 450, height: 302 };
// Bottom-left corner of that crop catches the tip of the "SHOESTRING" label below it.
export const LOGO_ERASE: Crop[] = [{ left: 0, top: 272, width: 42, height: 30 }];
