// Grava o vídeo de apresentação (1080x1920, 30 fps, 30 s) a partir de video/stage.html.
// Uso: npm run video                     → video/out/gbm-web-apresentacao-30s.mp4 e video/out/capa.png
//      node video/render.mjs --preview 2,5.8,12  → um PNG por segundo pedido, para conferir cenas
// Precisa de Playwright (Chromium), ffmpeg e das cenas do celular em video/shots/ (npm run video:shots).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { require, root, startStaticServer, captureDemo } from "../scripts/lib/static-server.mjs";

const { chromium } = require("playwright");
const out = path.join(root, "video", "out");
const FPS = 30;
const DURATION = 30;
const COVER_AT = 2.2;
const DEMOS = ["barbearia", "restaurante", "petshop"];
const previewIndex = process.argv.indexOf("--preview");
const previewTimes = previewIndex > -1 ? process.argv[previewIndex + 1].split(",").map(Number) : null;
if (!fs.existsSync(path.join(root, "video", "shots", "shots.json"))) {
  throw new Error("Faltam as cenas do celular em video/shots/. Gere com: npm run video:shots (Python com bpy, veja art/requirements.txt)");
}
const server = await startStaticServer();
const base = server.base;
const browser = await chromium.launch();

try {
  // 1. Phone-size prints of each demo for the "site inside the phone" scene.
  fs.mkdirSync(path.join(out, "screens"), { recursive: true });
  const shots = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const shot = await shots.newPage();
  for (const demo of DEMOS) await captureDemo(shot, base, demo, path.join(out, "screens", `${demo}.png`), 1700);
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
