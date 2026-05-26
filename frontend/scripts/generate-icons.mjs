/**
 * Generates PWA icons from a programmatic SVG design.
 * Three overlapping filled circles form an organic tree-crown blob,
 * sitting on a brown trunk, on a black background.
 * Run via: npm run icons
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");

// Colours
const BG     = "#000000";  // black background
const AMBER  = "#d4831a";  // amber crown
const DARK   = "#8a4a08";  // dark amber trunk + shadow
const LINE   = "#222222";  // border hairline

/**
 * Builds an SVG string for the Canopy icon at the given pixel size.
 *
 * Design (100×100 internal viewBox, scaled to target size):
 *  - Warm cream background (rounded for standard, full-bleed for maskable)
 *  - Geometric triangle crown in amber
 *  - Shadow overlay on right half for depth
 *  - Dark amber trunk
 */
function buildSVG(size, { maskable = false } = {}) {
  const rr = maskable ? 0 : Math.round(size * 0.1875);
  const bw = Math.max(1, Math.round(size * 0.004));

  const border = maskable
    ? ""
    : `<rect width="${size}" height="${size}" rx="${rr}" fill="none" stroke="${LINE}" stroke-width="${bw}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" rx="${maskable ? 0 : 18}" fill="${BG}"/>
  ${border}
  <rect x="44" y="64" width="12" height="22" rx="4" fill="${DARK}"/>
  <polygon points="50,16 80,64 20,64" fill="${AMBER}"/>
  <polygon points="50,28 72,64 50,64" fill="${DARK}" opacity="0.55"/>
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
