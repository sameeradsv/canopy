/**
 * Generates PWA icons from a programmatic SVG design.
 * The icon is a tree-canopy mark: three concentric upper-semicircle arcs
 * (foliage layers) above a short trunk, on a cream (paper-theme) background.
 * Run via: npm run icons
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");

// Paper theme colours (match CSS vars --bg, --fg, --line)
const BG   = "#f5efe2";   // oklch(0.972 0.012 78)
const FG   = "#29261b";   // oklch(0.24 0.020 60)
const LINE = "#d6cdbc";   // oklch(0.86 0.012 70)

/**
 * Builds an SVG string for the Canopy icon at the given pixel size.
 *
 * Design:
 *  - Cream background rectangle (rounded for standard, full-bleed for maskable)
 *  - Three concentric upper-semicircle arcs (canopy foliage layers)
 *  - A short rounded-rectangle trunk below the arcs
 *  - Thin border line (standard only)
 *
 * Geometry (all values relative to `size`):
 *  - Arc junction Y: 58% down (where arcs meet the trunk)
 *  - Arc radii: 13%, 24%, 35% of size (innermost → outermost)
 *  - Arc stroke: 6% of size
 *  - Trunk: 7.5% wide × 18% tall, starting at the arc junction
 */
function buildSVG(size, { maskable = false } = {}) {
  const cx = size / 2;

  // Arcs: concentric upper-semicircles sharing this Y as their flat base
  const arcCY  = size * 0.58;
  const radii  = [size * 0.13, size * 0.24, size * 0.35];
  const sw     = Math.max(1, size * 0.06);

  // Trunk below the arcs
  const trunkW = size * 0.075;
  const trunkH = size * 0.18;
  const trunkR = trunkW * 0.3;

  const rr = maskable ? 0 : Math.round(size * 0.1875);
  const borderW = Math.max(1, Math.round(size * 0.004));

  const border = maskable
    ? ""
    : `<rect width="${size}" height="${size}" rx="${rr}" fill="none" stroke="${LINE}" stroke-width="${borderW}"/>`;

  // Each arc: M (cx-r, arcCY) A r,r,0,0,1 (cx+r, arcCY)  → upper half-circle
  const arcs = radii.map(r => {
    const x1 = (cx - r).toFixed(2);
    const x2 = (cx + r).toFixed(2);
    const cy  = arcCY.toFixed(2);
    return `<path d="M ${x1},${cy} A ${r.toFixed(2)},${r.toFixed(2)},0,0,1,${x2},${cy}" fill="none" stroke="${FG}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`;
  }).join("\n  ");

  const tx = (cx - trunkW / 2).toFixed(2);
  const trunk = `<rect x="${tx}" y="${arcCY.toFixed(2)}" width="${trunkW.toFixed(2)}" height="${trunkH.toFixed(2)}" rx="${trunkR.toFixed(2)}" fill="${FG}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rr}" fill="${BG}"/>
  ${border}
  ${arcs}
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
