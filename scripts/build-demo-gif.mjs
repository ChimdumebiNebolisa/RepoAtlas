#!/usr/bin/env node
/**
 * Build docs/demo.gif from docs/images/*.png frames (requires pngjs + gifenc).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const imagesDir = path.join(root, "docs", "images");
const outPath = path.join(root, "docs", "demo.gif");

const FRAME_FILES = [
  "landing.png",
  "candidate-brief.png",
  "reading-path.png",
  "first-pr-plan.png",
  "export-tab.png",
];

function loadFrame(fileName) {
  const buffer = fs.readFileSync(path.join(imagesDir, fileName));
  return PNG.sync.read(buffer);
}

function resizeNearest(src, targetW, targetH) {
  const dst = new PNG({ width: targetW, height: targetH });
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sx = Math.floor((x / targetW) * src.width);
      const sy = Math.floor((y / targetH) * src.height);
      const si = (sy * src.width + sx) << 2;
      const di = (y * targetW + x) << 2;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return dst;
}

const targetW = 960;
const targetH = 640;
const frames = FRAME_FILES.map((file) => {
  if (!fs.existsSync(path.join(imagesDir, file))) {
    throw new Error(`Missing frame ${file}. Run: npm run capture:portfolio`);
  }
  return resizeNearest(loadFrame(file), targetW, targetH);
});

const encoder = GIFEncoder();
encoder.writeHeader();

for (const frame of frames) {
  const rgba = new Uint8Array(frame.data);
  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);
  encoder.writeFrame(index, targetW, targetH, { palette, delay: 120 });
}

encoder.finish();
fs.writeFileSync(outPath, Buffer.from(encoder.bytes()));
console.log(`Wrote ${outPath}`);
