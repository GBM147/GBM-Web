// Gera as telas do celular 3D do topo em public/assets/screens/ (WebP).
// Uso: npm run screens   (refaça quando os exemplos de /projetos mudarem)
// Precisa de Playwright (Chromium) e ffmpeg com libwebp.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { require, root, startStaticServer, captureDemo } from "./lib/static-server.mjs";

const { chromium } = require("playwright");
const out = path.join(root, "public", "assets", "screens");
const temp = fs.mkdtempSync(path.join(root, "video", ".screens-"));
const toWebp = (png, name) => {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-quality", "78", path.join(out, `${name}.webp`)]);
};

fs.mkdirSync(out, { recursive: true });
const server = await startStaticServer();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await context.newPage();
  // Each demo is a tall print: the 3D screen scrolls through it.
  for (const demo of ["barbearia", "restaurante", "petshop"]) {
    const png = path.join(temp, `${demo}.png`);
    await captureDemo(page, server.base, demo, png, 1500);
    toWebp(png, demo);
  }
  await page.goto(`${server.base}/scripts/screens/whatsapp.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const chat = path.join(temp, "whatsapp.png");
  await page.screenshot({ path: chat });
  toWebp(chat, "whatsapp");
  for (const file of fs.readdirSync(out)) console.log(`${file}: ${Math.round(fs.statSync(path.join(out, file)).size / 1024)} KB`);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
