// Desenha no Chromium as texturas da traseira do celular (cor e máscara do logo),
// com a mesma fonte e o mesmo símbolo do site. Usado por art/video_shots.py.
// Uso: node art/textures.mjs  → art/out/textures/back.png e back-mask.png
import fs from "node:fs";
import path from "node:path";
import { require, root, startStaticServer } from "../scripts/lib/static-server.mjs";

const { chromium } = require("playwright");
const out = path.join(root, "art", "out", "textures");
fs.mkdirSync(out, { recursive: true });
const server = await startStaticServer();
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await page.goto(`${server.base}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.load('700 108px "Manrope"'));
  const images = await page.evaluate(() => {
    // Back glass is 0.97 x 2.03 phone units. Same layout as backTexture() in src/hero3d.js, at 2x.
    const width = 1024;
    const height = 2144;
    const draw = (mask) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (mask) {
        context.fillStyle = "#000";
      } else {
        const gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#2d2b27");
        gradient.addColorStop(1, "#191816");
        context.fillStyle = gradient;
      }
      context.fillRect(0, 0, width, height);
      context.save();
      context.translate(width / 2 - 140, height / 2 - 220);
      context.scale(7, 7);
      context.strokeStyle = mask ? "#fff" : "#e65a32";
      context.lineWidth = 5;
      context.stroke(new Path2D("M28 10a14 14 0 1 0 5 14H20"));
      context.lineWidth = 4;
      context.stroke(new Path2D("M25 4h11v11"));
      context.stroke(new Path2D("m24 16 12-12"));
      context.restore();
      context.fillStyle = mask ? "#fff" : "#f6f4ee";
      context.font = '700 108px "Manrope", sans-serif';
      context.textAlign = "center";
      context.fillText("GBM Web", width / 2, height / 2 + 240);
      return canvas.toDataURL("image/png");
    };
    return { back: draw(false), mask: draw(true) };
  });
  for (const [name, data] of [["back", images.back], ["back-mask", images.mask]]) {
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data.split(",")[1], "base64"));
  }
  console.log(`Texturas salvas em ${out}`);
} finally {
  await browser.close();
  server.close();
}
