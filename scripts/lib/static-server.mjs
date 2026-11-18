// Servidor local usado pelos scripts de captura (vídeo e telas do celular 3D).
// Serve o site (public/), as bibliotecas direto do node_modules e as pastas
// video/ e scripts/screens/ num único endereço.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const require = createRequire(import.meta.url);
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2"
};

export async function startStaticServer() {
  const routes = [
    ["/video/", path.join(root, "video")],
    ["/scripts/screens/", path.join(root, "scripts", "screens")],
    ["/vendor/gsap/", path.dirname(require.resolve("gsap/dist/gsap.min.js"))],
    ["/vendor/lenis/", path.dirname(require.resolve("lenis/dist/lenis.min.js"))],
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
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

// Phone-size print of a demo from /projetos, without the GBM tab bar, so it looks like the client's own site.
export async function captureDemo(page, base, demo, file, height) {
  await page.goto(`${base}/projetos.html#${demo}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ".demo-notice { display: none !important; } body { padding-top: 0 !important; }" });
  await page.evaluate(() => document.fonts.ready);
  // The photo of a demo shown by a tab can still be loading when the network goes quiet.
  await page.evaluate(() => Promise.all([...document.images].filter((image) => image.offsetParent).map((image) => image.decode().catch(() => {}))));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: 390, height } });
}
