/**
 * Renders every raster icon from the SVG sources in brand/ (see brand/README.md).
 * Run after changing a source, and commit the output:
 *
 *   npm run icons
 *
 * Outputs:
 *   src/app/icon.svg                 favicon, switches with the browser's color scheme
 *   src/app/favicon.ico              16/32/48 tile, for browsers that skip the SVG
 *   src/app/apple-icon.png           iOS home screen (180, square; iOS rounds it)
 *   public/icon-192.png, -512.png    manifest "any" icons (rounded tile)
 *   public/icon-maskable-192.png, -512.png  manifest maskable icons (safe-zone padded)
 *   brand/*.png                      512 and 1024 exports for docs, GitHub and listings
 */
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (name) => resolve(root, "brand", name);

async function png(svgName, width, height = width) {
  const svg = await readFile(brand(svgName));
  // A high density keeps edges crisp before the resize.
  return sharp(svg, { density: 384 }).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function emit(svgName, outPath, width, height = width) {
  await writeFile(resolve(root, outPath), await png(svgName, width, height));
  console.log(`  wrote ${outPath} (${width}x${height})`);
}

/** Packs PNG images into one .ico file (PNG-compressed entries, supported everywhere current). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

console.log("Rendering icons from brand/…");
await copyFile(brand("feelium-favicon.svg"), resolve(root, "src/app/icon.svg"));
console.log("  wrote src/app/icon.svg");

const favicon = [];
for (const size of [16, 32, 48]) favicon.push({ size, data: await png("feelium-tile.svg", size) });
await writeFile(resolve(root, "src/app/favicon.ico"), ico(favicon));
console.log("  wrote src/app/favicon.ico (16, 32, 48)");

await emit("feelium-tile-square.svg", "src/app/apple-icon.png", 180);
await emit("feelium-tile.svg", "public/icon-192.png", 192);
await emit("feelium-tile.svg", "public/icon-512.png", 512);
await emit("feelium-tile-maskable.svg", "public/icon-maskable-192.png", 192);
await emit("feelium-tile-maskable.svg", "public/icon-maskable-512.png", 512);

// The marks are 376x256 (the two discs plus clear space).
for (const variant of ["light", "dark"]) {
  await emit(`feelium-mark-${variant}.svg`, `brand/feelium-mark-${variant}.png`, 512, 349);
  await emit(`feelium-mark-${variant}.svg`, `brand/feelium-mark-${variant}-1024.png`, 1024, 698);
}
await emit("feelium-tile.svg", "brand/feelium.png", 512);
await emit("feelium-tile.svg", "brand/feelium-tile-1024.png", 1024);
console.log("Done.");
