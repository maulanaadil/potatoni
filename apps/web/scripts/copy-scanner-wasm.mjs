// Copies the ZXing WebAssembly reader (the voucher QR scanner's fallback for browsers
// without a native BarcodeDetector, e.g. iPhone Safari) into public/wasm, so it's served
// from our own domain instead of a public CDN. Runs on every install (postinstall).
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const detectorEntry = require.resolve("barcode-detector/ponyfill");
let dir = path.dirname(createRequire(detectorEntry).resolve("zxing-wasm/reader"));
while (!existsSync(path.join(dir, "package.json")) || JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).name !== "zxing-wasm") {
  const parent = path.dirname(dir);
  if (parent === dir) throw new Error("zxing-wasm package not found");
  dir = parent;
}
const target = path.join(import.meta.dirname, "..", "public", "wasm");
mkdirSync(target, { recursive: true });
copyFileSync(path.join(dir, "dist/reader/zxing_reader.wasm"), path.join(target, "zxing_reader.wasm"));
console.log(`scanner wasm: zxing-wasm@${JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version} → public/wasm/zxing_reader.wasm`);
