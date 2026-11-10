// Grava o vídeo de apresentação (1080x1920, 30 fps, 30 s) a partir de video/stage.html.
// Uso: npm run video                     → video/out/gbm-web-apresentacao-30s.mp4 e video/out/capa.png
//      node video/render.mjs --preview 2,5.8,12  → um PNG por segundo pedido, para conferir cenas
// Precisa de Playwright (Chromium) e ffmpeg instalados.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "video", "out");
const FPS = 30;
const DURATION = 30;
const COVER_AT = 2.2;
const DEMOS = ["barbearia", "restaurante", "petshop"];
const previewIndex = process.argv.indexOf("--preview");
const previewTimes = previewIndex > -1 ? process.argv[previewIndex + 1].split(",").map(Number) : null;

// Serves the site (public/), the GSAP bundles and this folder from one local address.
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const routes = [
  ["/video/", path.join(root, "video")],
  ["/vendor/gsap/", path.dirname(require.resolve("gsap/dist/gsap.min.js"))],
  ["/", path.join(root, "public")]
];
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const [prefix, folder] = routes.find(([start]) => pathname.startsWith(start));
  let file = path.join(folder, pathname.slice(prefix.length));
  if (!file.startsWith(folder)) { response.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

try {
  // 1. Phone-size prints of each demo for the "site inside the phone" scene.
  fs.mkdirSync(path.join(out, "screens"), { recursive: true });
  const shots = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const shot = await shots.newPage();
  for (const demo of DEMOS) {
    await shot.goto(`${base}/projetos.html#${demo}`, { waitUntil: "networkidle" });
    await shot.evaluate(() => document.fonts.ready);
    await shot.screenshot({ path: path.join(out, "screens", `${demo}.png`), fullPage: true, clip: { x: 0, y: 0, width: 390, height: 1700 } });
  }
  await shots.close();

  // 2. Load the stage and step its timeline frame by frame.
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const stage = await context.newPage();
  const errors = [];
  stage.on("pageerror", (error) => errors.push(error.message));
  await stage.goto(`${base}/video/stage.html`, { waitUntil: "networkidle" });
  await stage.waitForFunction(() => window.stageReady === true, null, { timeout: 30000 });
  const seek = (seconds) => stage.evaluate((time) => { window.tl.seek(time, false); }, seconds);

  if (previewTimes) {
    // Seek forward through every frame up to each requested time so callbacks fire in order.
    let frame = 0;
    for (const time of [...previewTimes].sort((a, b) => a - b)) {
      for (; frame <= Math.round(time * FPS); frame++) await seek(frame / FPS);
      await stage.screenshot({ path: path.join(out, `preview-${time.toFixed(1)}s.png`) });
    }
    console.log(`Prévias salvas em ${out}`);
  } else {
    const file = path.join(out, "gbm-web-apresentacao-30s.mp4");
    const ffmpeg = spawn("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
      "-profile:v", "high", "-level", "4.1", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", file
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const finished = new Promise((resolve, reject) => ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}`)))));
    const write = (buffer) => new Promise((resolve, reject) => ffmpeg.stdin.write(buffer, (error) => (error ? reject(error) : resolve())));
    const total = FPS * DURATION;
    for (let frame = 0; frame < total; frame++) {
      await seek(frame / FPS);
      const png = await stage.screenshot({ type: "png" });
      if (frame === Math.round(COVER_AT * FPS)) fs.writeFileSync(path.join(out, "capa.png"), png);
      await write(png);
      if (frame % (FPS * 5) === 0) console.log(`quadro ${frame}/${total}`);
    }
    ffmpeg.stdin.end();
    await finished;
    console.log(`Vídeo salvo em ${file}`);
  }
  if (errors.length) throw new Error(`Erros na página do vídeo: ${errors.join(" | ")}`);
} finally {
  await browser.close();
  server.close();
}
