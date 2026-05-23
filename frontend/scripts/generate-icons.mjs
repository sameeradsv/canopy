/**
 * Generates PWA icons from a programmatic SVG design.
 * Three overlapping filled circles form an organic tree-crown blob,
 * sitting on a brown trunk, on a cream background.
 * Run via: npm run icons
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");

// Colours
const BG    = "#f5efe2";  // cream background
const CROWN = "#3d6b4f";  // muted forest green
const TRUNK = "#7a5c3a";  // warm brown
const LINE  = "#d6cdbc";  // border hairline

/**
 * Builds an SVG string for the Canopy icon at the given pixel size.
 *
 * Design:
 *  - Cream background (rounded for standard, full-bleed for maskable)
 *  - Three overlapping filled circles form an organic tree-crown blob:
 *    one centre circle (larger, higher) + two side circles (lower, smaller)
 *  - A rounded-rectangle trunk below the crown
 *  - Thin border (standard only)
 *
 * Geometry (all values relative to `size`):
 *  - Centre circle: cy=41%, r=22%
 *  - Side circles:  cy=47%, r=18%, offset ±11% from centre
 *  - Trunk:         7.5% wide × 18% tall
 */
function buildSVG(size, { maskable = false } = {}) {
  const cx = size / 2;
  const rr = maskable ? 0 : Math.round(size * 0.1875);
  const bw = Math.max(1, Math.round(size * 0.004));

  // Three overlapping circles — same fill so they merge into one organic blob
  const circles = [
    { x: cx,                 y: size * 0.41, r: size * 0.22 }, // centre (tallest)
    { x: cx - size * 0.11,  y: size * 0.47, r: size * 0.18 }, // left
    { x: cx + size * 0.11,  y: size * 0.47, r: size * 0.18 }, // right
  ];

  const crownShapes = circles
    .map(({ x, y, r }) =>
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${CROWN}"/>`)
    .join("\n  ");

  // Trunk starts at the bottom of the centre circle
  const trunkY = circles[0].y + circles[0].r;
  const trunkW = size * 0.075;
  const trunkH = size * 0.18;
  const trunkR = trunkW * 0.3;
  const trunk = `<rect x="${(cx - trunkW / 2).toFixed(2)}" y="${trunkY.toFixed(2)}" width="${trunkW.toFixed(2)}" height="${trunkH.toFixed(2)}" rx="${trunkR.toFixed(2)}" fill="${TRUNK}"/>`;

  const border = maskable
    ? ""
    : `<rect width="${size}" height="${size}" rx="${rr}" fill="none" stroke="${LINE}" stroke-width="${bw}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rr}" fill="${BG}"/>
  ${border}
  ${crownShapes}
  ${trunk}
</svg>`;
}

await mkdir(iconsDir, { recursive: true });

const icons = [
  // Standard icons — cream bg, rounded rect
  { file: "favicon-16x16.png",   size: 16,  maskable: false },
  { file: "favicon-32x32.png",   size: 32,  maskable: false },
  { file: "apple-touch-icon.png",size: 180, maskable: false },
  { file: "icon-192x192.png",    size: 192, maskable: false },
  { file: "icon-384x384.png",    size: 384, maskable: false },
  { file: "icon-512x512.png",    size: 512, maskable: false },
  // Maskable icon — full-bleed for Android adaptive icons
  { file: "icon-512x512-maskable.png", size: 512, maskable: true },
];

for (const { file, size, maskable } of icons) {
  const svg = buildSVG(size, { maskable });
  const buf = Buffer.from(svg, "utf8");
  const dest = path.join(iconsDir, file);
  await sharp(buf, { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(dest);
  console.log(`  ✓ ${file} (${size}×${size}${maskable ? ", maskable" : ""})`);
}

// Also write the 32px favicon to public/favicon.png (browser default lookup)
const favicon32 = path.join(iconsDir, "favicon-32x32.png");
const faviconDest = path.join(root, "public", "favicon.png");
await copyFile(favicon32, faviconDest);
console.log("  ✓ favicon.png");

// Write the 180px apple-touch-icon to public/ root (iOS Safari looks here first)
const appleSrc = path.join(iconsDir, "apple-touch-icon.png");
const appleDest = path.join(root, "public", "apple-touch-icon.png");
await copyFile(appleSrc, appleDest);
console.log("  ✓ apple-touch-icon.png (root)");

console.log(`\nGenerated ${icons.length} icons.`);
