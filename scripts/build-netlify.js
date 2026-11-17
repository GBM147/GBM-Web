const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

// O Netlify publica só public/: as bibliotecas do frontend são copiadas ou
// empacotadas para public/vendor/ (fora do git, gerado a cada build).
const root = path.join(__dirname, "..");
const vendor = path.join(root, "public", "vendor");

const copies = [
  [path.dirname(require.resolve("gsap/dist/gsap.min.js")), "gsap", ["gsap.min.js", "ScrollTrigger.min.js"]],
  [path.dirname(require.resolve("lenis/dist/lenis.min.js")), "lenis", ["lenis.min.js"]]
];
for (const [source, folder, files] of copies) {
  fs.mkdirSync(path.join(vendor, folder), { recursive: true });
  for (const name of files) fs.copyFileSync(path.join(source, name), path.join(vendor, folder, name));
}

// A cena 3D do topo (Three.js) vira um único módulo minificado, só com o que ela usa.
esbuild.buildSync({
  entryPoints: [path.join(root, "src", "hero3d.js")],
  outfile: path.join(vendor, "hero3d.js"),
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  legalComments: "eof",
  logLevel: "warning"
});

console.log("Build Netlify: GSAP, Lenis e cena 3D preparados em public/vendor/.");
