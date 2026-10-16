const fs = require("node:fs");
const path = require("node:path");

// O servidor Express servia o GSAP diretamente do node_modules.
// No Netlify, os arquivos precisam estar em public/ na publicação estática.
const gsapDir = path.dirname(require.resolve("gsap/dist/gsap.min.js"));
const targetDir = path.join(__dirname, "..", "public", "vendor", "gsap");

fs.mkdirSync(targetDir, { recursive: true });

for (const name of ["gsap.min.js", "ScrollTrigger.min.js"]) {
  fs.copyFileSync(path.join(gsapDir, name), path.join(targetDir, name));
}

console.log("Build Netlify: frontend e GSAP preparados para publicação.");
