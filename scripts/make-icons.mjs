import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });
const svg = readFileSync("public/icons/logo.svg");

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

for (const [out, size] of targets) {
  await sharp(svg, { density: 400 }).resize(size, size).png().toFile(out);
  console.log("✓", out);
}

const inner = await sharp(svg, { density: 400 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0b0d16" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");
console.log("✓ public/icons/icon-maskable-512.png");

await sharp(svg, { density: 300 }).resize(64, 64).png().toFile("app/icon.png");
console.log("✓ app/icon.png");
