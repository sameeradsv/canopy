/**
 * Generates PWA icons from a programmatic SVG design.
 * The icon is a layered-foliage canopy mark: three upper-semicircle arcs
 * at different heights (smallest/highest → largest/lowest), with a trunk.
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
 *  - Cream background (rounded for standard, full-bleed for maskable)
 *  - Three upper-semicircle arcs, each with its own baseline Y so they
 *    read as stacked foliage tiers, not concentric rings
 *  - Innermost (smallest) arc sits highest; outermost (largest) sits lowest
 *  - A short trunk below the lowest arc
 *  - Thin border (standard only)
 *
 * Geometry (all values relative to `size`):
 *  - Tier baselines: 37%, 49%, 61% down
 *  - Tier radii:     10%, 18%, 26% of size
 *  - Stroke:         6.5% of size
 *  - Trunk:          7.5% wide × 16% tall
 */
function buildSVG(size, { maskable = false } = {}) {
  const cx  = size / 2;
  const sw  = Math.max(1, size * 0.065);
  const rr  = maskable ? 0 : Math.round(size * 0.1875);
  const bw  = Math.max(1, Math.round(size * 0.004));

  // Each tier: own baseY keeps arcs from looking like WiFi concentric rings.
  const tiers = [
    { r: size * 0.10, baseY: size * 0.37 },
    { r: size * 0.18, baseY: size * 0.49 },
    { r: size * 0.26, baseY: size * 0.61 },
  ];

  const arcPaths = tiers.map(({ r, baseY }) => {
    const x1 = (cx - r).toFixed(2);
    const x2 = (cx + r).toFixed(2);
    const y  = baseY.toFixed(2);
    return `<path d="M ${x1},${y} A ${r.toFixed(2)},${r.toFixed(2)},0,0,1,${x2},${y}" fill="none" stroke="${FG}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`;
  }).join("\n  ");

  const { baseY: trunkY } = tiers[tiers.length - 1];
  const trunkW = size * 0.075;
  const trunkH = size * 0.16;
  const trunkR = trunkW * 0.3;
  const trunk = `<rect x="${(cx - trunkW / 2).toFixed(2)}" y="${trunkY.toFixed(2)}" width="${trunkW.toFixed(2)}" height="${trunkH.toFixed(2)}" rx="${trunkR.toFixed(2)}" fill="${FG}"/>`;

  const border = maskable
    ? ""
    : `<rect width="${size}" height="${size}" rx="${rr}" fill="none" stroke="${LINE}" stroke-width="${bw}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rr}" fill="${BG}"/>
  ${border}
  ${arcPaths}
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
