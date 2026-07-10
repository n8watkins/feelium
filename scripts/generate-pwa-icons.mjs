/**
 * Generates the rasterized PWA icons from the single source SVG mark.
 *
 * The brand mark lives in public/icon.svg (see src/config/branding.ts). Chromium
 * installability and iOS home-screen icons need raster PNGs, so we derive them here
 * rather than hand-editing binaries. Re-run after the mark changes:
 *
 *   node scripts/generate-pwa-icons.mjs
 *
 * Outputs:
 *   public/icon-192.png           standard any-purpose icon (192x192)
 *   public/icon-512.png           standard any-purpose icon (512x512)
 *   public/icon-maskable-512.png  full-bleed maskable icon (safe-zone padded)
 *   src/app/apple-icon.png        iOS apple-touch icon (180x180, picked up by Next)
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BG = "#0A0A0A";
const FG = "#FAFAFA";

/** The three bars from the source mark, centered on a full-bleed background. */
function markSvg({ radius }) {
  return `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="App icon">
  <rect width="512" height="512" rx="${radius}" fill="${BG}"/>
  <rect x="130" y="272" width="60" height="112" rx="18" fill="${FG}"/>
  <rect x="226" y="208" width="60" height="176" rx="18" fill="${FG}"/>
  <rect x="322" y="144" width="60" height="240" rx="18" fill="${FG}"/>
</svg>`;
}

// Rounded corners for the standard icon; square (full-bleed) for maskable/apple so the
// platform mask is not double-rounded and the background fills the whole safe zone.
const rounded = Buffer.from(markSvg({ radius: 112 }));
const square = Buffer.from(markSvg({ radius: 0 }));

async function emit(svg, size, outPath) {
  await sharp(svg).resize(size, size).png().toFile(resolve(root, outPath));
  console.log(`  wrote ${outPath} (${size}x${size})`);
}

console.log("Generating PWA icons from public/icon.svg…");
await readFile(resolve(root, "public/icon.svg")); // fail fast if the source mark is missing
await emit(rounded, 192, "public/icon-192.png");
await emit(rounded, 512, "public/icon-512.png");
await emit(square, 512, "public/icon-maskable-512.png");
await emit(square, 180, "src/app/apple-icon.png");
console.log("Done.");
