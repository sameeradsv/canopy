/**
 * Generates PWA icons from a programmatic SVG design.
 * The icon is a bold geometric "C" arc on a cream (paper-theme) background.
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
 *  - A bold arc forming the letter "C", opening to the right
 *  - Thin border line (standard only)
 *
 * The "C" arc:
 *  - Radius = 27.4% of size (≈ 140 @ 512px)
 *  - Stroke width = 13.3% of size (≈ 68 @ 512px)
 *  - Opening: ±40° from the right-most point (leaving 280° of arc)
 */
function buildSVG(size, { maskable = false } = {}) {
  const cx = size / 2;
  const cy = size / 2;

  // Arc geometry
  const r  = size * 0.274;          // arc radius
  const sw = size * 0.133;          // stroke width

  // Opening half-angle in degrees (gap = 2 × gap°)
  const gapDeg = 40;
  const gapRad = (gapDeg * Math.PI) / 180;

  // Start point: upper-right edge of the opening
  const x1 = cx + r * Math.cos(-gapRad);
  const y1 = cy + r * Math.sin(-gapRad);

  // End point: lower-right edge of the opening
  const x2 = cx + r * Math.cos(gapRad);
  const y2 = cy + r * Math.sin(gapRad);

  // SVG arc: large-arc-flag=1, sweep-flag=0 → 280° counter-clockwise = body on the left
  const arcPath = `M ${x1.toFixed(2)},${y1.toFixed(2)} A ${r.toFixed(2)},${r.toFixed(2)},0,1,0,${x2.toFixed(2)},${y2.toFixed(2)}`;

  const rr = maskable ? 0 : Math.round(size * 0.1875);  // ≈ 96 @ 512px
  const borderW = Math.max(1, Math.round(size * 0.004));

  const border = maskable
    ? ""
    : `<rect width="${size}" height="${size}" rx="${rr}" fill="none" stroke="${LINE}" stroke-width="${borderW}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rr}" fill="${BG}"/>
  ${border}
  <path d="${arcPath}" fill="none" stroke="${FG}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>
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
