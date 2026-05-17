import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "scripts", "icon-source.png");
const iconsDir = path.join(root, "public", "icons");

const outputs = [
  { file: "icon-192x192.png", size: 192 },
  { file: "icon-384x384.png", size: 384 },
  { file: "icon-512x512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-16x16.png", size: 16 },
];

await mkdir(iconsDir, { recursive: true });

for (const { file, size } of outputs) {
  await sharp(source).resize(size, size).png().toFile(path.join(iconsDir, file));
}

await sharp(source).resize(32, 32).png().toFile(path.join(root, "public", "favicon.png"));

console.log(`Generated ${outputs.length + 1} icons in public/`);
