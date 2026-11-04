/**
 * iOS launch screens, light and dark, so an installed feelium opens on
 * its own background with the tile centered instead of a white flash.
 * Run with `node scripts/generate-splash.mjs`; outputs are committed in public/splash/.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Portrait CSS size and pixel ratio of the devices most people use.
export const SPLASH_DEVICES = [
  { width: 430, height: 932, ratio: 3 }, // iPhone 14/15/16 Pro Max and Plus
  { width: 393, height: 852, ratio: 3 }, // iPhone 14 Pro, 15, 16
  { width: 390, height: 844, ratio: 3 }, // iPhone 12, 13, 14
  { width: 375, height: 667, ratio: 2 }, // iPhone SE
  { width: 820, height: 1180, ratio: 2 }, // iPad Air
  { width: 834, height: 1194, ratio: 2 }, // iPad Pro 11"
];
const tile = await readFile(resolve(root, "brand/feelium-tile.svg"));
for (const { width, height, ratio } of SPLASH_DEVICES) {
  const [w, h] = [width * ratio, height * ratio];
  const size = Math.round(Math.min(w, h) * 0.26);
  const icon = await sharp(tile, { density: 384 }).resize(size, size).png().toBuffer();
  for (const [scheme, background] of [["light", "#ffffff"], ["dark", "#0a0a0a"]]) {
    const file = `public/splash/${w}x${h}-${scheme}.png`;
    await sharp({ create: { width: w, height: h, channels: 4, background } })
      .composite([{ input: icon, left: Math.round((w - size) / 2), top: Math.round((h - size) / 2) }])
      .png({ compressionLevel: 9 })
      .toFile(resolve(root, file));
    console.log(`wrote ${file}`);
  }
}
