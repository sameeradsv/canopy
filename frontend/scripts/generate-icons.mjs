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
const BG    = "#f8f3e8";  // warm cream background
const CROWN = "#2d7040";  // deep forest green
const TRUNK = "#7a4015";  // dark bark brown
const LINE  = "#d6cdbc";  // border hairline

/**
 * Builds an SVG string for the Canopy icon at the given pixel size.
 *
 * Design (100×100 internal viewBox, scaled to target size):
 *  - Warm cream background (rounded for standard, full-bleed for maskable)
 *  - Wide multi-lobed crown (5 foliage bumps, sides droop low)
 *  - Trunk tapers wider toward the base
 *  - Thin border (standard only)
 */
function buildSVG(size, { maskable = false } = {}) {
  const rr = maskable ? 0 : Math.round(size * 0.1875);
  const bw = Math.max(1, Math.round(size * 0.004));

  const border = maskable
    ? ""
    : `<rect width="${size}" height="${size}" rx="${rr}" fill="none" stroke="${LINE}" stroke-width="${bw}"/>`;

  // All geometry defined in 0–100 space; SVG viewBox scales to `size`.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" rx="${maskable ? 0 : 18}" fill="${BG}"/>
  ${border}
  <!-- trunk: thin stick -->
  <rect x="47" y="55" width="6" height="32" rx="3" fill="${TRUNK}"/>
  <!-- canopy: wide flat dome with scalloped leaf edge — acacia/parasol shape -->
  <path d="M 8 55 C 8 30 92 30 92 55 Q 83 64 74 55 Q 65 64 56 55 Q 47 64 38 55 Q 29 64 20 55 Q 14 61 8 55 Z" fill="${CROWN}"/>
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
