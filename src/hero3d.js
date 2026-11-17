// Cena 3D da página: um celular modelado no código que acompanha a rolagem pela
// página inteira (topo, planos e contato). A coreografia fica em public/animations.js,
// que passa uma pose alvo; aqui a cena só chega nela de forma suave.
// Empacotado por scripts/build-netlify.js em public/vendor/hero3d.js.
import {
  AdditiveBlending, AmbientLight, BufferGeometry, CanvasTexture, Color, DirectionalLight, Float32BufferAttribute,
  Group, LinearFilter, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PerspectiveCamera, PMREMGenerator,
  PointLight, Points, PointsMaterial, Scene, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, WebGLRenderer,
  ACESFilmicToneMapping, MathUtils, CylinderGeometry
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BODY = { width: 1, height: 2.06, depth: 0.105, radius: 0.15 };
const SCREEN = { width: 0.92, height: 1.98, radius: 0.12 };
const FOV = 30;
const DISTANCE = 7;

function roundedRect(width, height, radius) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new ShapeGeometry(shape, 12);
  // UVs from 0 to 1 across the rectangle, so a texture fills the rounded screen.
  const position = geometry.attributes.position;
  const uv = [];
  for (let i = 0; i < position.count; i++) uv.push((position.getX(i) - x) / width, (position.getY(i) - y) / height);
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return geometry;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// GBM symbol on the back of the phone, drawn from the same paths as #brand-mark.
const backTexture = () => canvasTexture(512, 1054, (context, width, height) => {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#2d2b27");
  gradient.addColorStop(1, "#191816");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(width / 2 - 70, height / 2 - 110);
  context.scale(3.5, 3.5);
  context.strokeStyle = "#e65a32";
  context.lineWidth = 5;
  context.stroke(new Path2D("M28 10a14 14 0 1 0 5 14H20"));
  context.lineWidth = 4;
  context.stroke(new Path2D("M25 4h11v11"));
  context.stroke(new Path2D("m24 16 12-12"));
  context.restore();
  context.fillStyle = "#f6f4ee";
  context.font = "700 54px Manrope, sans-serif";
  context.textAlign = "center";
  context.fillText("GBM Web", width / 2, height / 2 + 120);
});

const glossTexture = () => canvasTexture(256, 512, (context, width, height) => {
  const gradient = context.createLinearGradient(0, 0, width, height * 0.7);
  gradient.addColorStop(0, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.08)");
  gradient.addColorStop(0.36, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
});

const sparkTexture = () => canvasTexture(64, 64, (context) => {
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,170,120,0.8)");
  gradient.addColorStop(1, "rgba(255,120,60,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
});

/**
 * createPhoneScene(canvas, { screens, onReady })
 * - setTarget({ x, y, h, rx, ry, rz }): x and y are offsets from the viewport center as a
 *   fraction of its width and height (y up); h is the phone height as a fraction of the
 *   viewport height. The phone eases toward the target every frame.
 * - setScreen(a, b, mix, scroll): screen `a` scrolled by `scroll` (0..1), with screen `b` on top at `mix` opacity.
 * - pointer(x, y), start(), stop(), jump(), dispose()
 */
export function createPhoneScene(canvas, { screens, onReady } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, DISTANCE);

  scene.add(new AmbientLight(0xffffff, 0.25));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);

  // Phone and its lights move together, so the orange rim follows it across the page.
  const pivot = new Group();
  const phone = new Group();
  pivot.add(phone);
  scene.add(pivot);
  const rimLeft = new PointLight(0xff5a1f, 40, 9);
  rimLeft.position.set(-2.4, -1.4, -1.6);
  const rimRight = new PointLight(0xff9a64, 24, 9);
  rimRight.position.set(2.6, 1.8, -1.2);
  pivot.add(rimLeft, rimRight);

  const body = new Mesh(
    new RoundedBoxGeometry(BODY.width, BODY.height, BODY.depth, 6, BODY.radius),
    new MeshPhysicalMaterial({ color: new Color("#2b2a27"), metalness: 0.85, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 })
  );
  phone.add(body);
  const screenGeometry = roundedRect(SCREEN.width, SCREEN.height, SCREEN.radius);
  const front = BODY.depth / 2 + 0.002;
  const screenA = new Mesh(screenGeometry, new MeshBasicMaterial({ color: 0x111111, toneMapped: false }));
  screenA.position.z = front;
  const screenB = new Mesh(screenGeometry, new MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false }));
  screenB.position.z = front + 0.001;
  const gloss = new Mesh(screenGeometry, new MeshBasicMaterial({ map: glossTexture(), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
  gloss.position.z = front + 0.002;
  const island = new Mesh(roundedRect(0.26, 0.075, 0.037), new MeshBasicMaterial({ color: 0x050505 }));
  island.position.set(0, SCREEN.height / 2 - 0.08, front + 0.003);
  phone.add(screenA, screenB, gloss, island);
  const back = new Mesh(roundedRect(BODY.width - 0.02, BODY.height - 0.02, BODY.radius), new MeshPhysicalMaterial({ map: backTexture(), metalness: 0.4, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.15 }));
  back.position.z = -BODY.depth / 2 - 0.002;
  back.rotation.y = Math.PI;
  phone.add(back);
  const bump = new Mesh(new RoundedBoxGeometry(0.36, 0.36, 0.04, 4, 0.09), new MeshPhysicalMaterial({ color: 0x23221f, metalness: 0.7, roughness: 0.25, clearcoat: 1 }));
  bump.position.set(0.24, BODY.height / 2 - 0.27, -BODY.depth / 2 - 0.02);
  phone.add(bump);
  const lensMaterial = new MeshPhysicalMaterial({ color: 0x0b0b0c, metalness: 0.2, roughness: 0.05, clearcoat: 1 });
  for (const [x, y] of [[0.17, 0.08], [0.31, -0.06], [0.17, -0.06]]) {
    const lens = new Mesh(new CylinderGeometry(0.055, 0.055, 0.03, 32), lensMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, BODY.height / 2 - 0.27 + y, -BODY.depth / 2 - 0.045);
    phone.add(lens);
  }

  // Sparks floating around the phone (they travel with it).
  const COUNT = 120;
  const seeds = [];
  for (let i = 0; i < COUNT; i++) {
    seeds.push({ x: (Math.random() - 0.5) * 3.4, y: (Math.random() - 0.5) * 3.2, z: (Math.random() - 0.5) * 2 - 0.4, speed: 0.08 + Math.random() * 0.18 });
  }
  const sparkGeometry = new BufferGeometry();
  sparkGeometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
  const sparks = new Points(sparkGeometry, new PointsMaterial({ map: sparkTexture(), size: 0.05, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  pivot.add(sparks);

  // Screen textures: tall prints that scroll inside the screen.
  const loader = new TextureLoader();
  const textures = [];
  const ready = Promise.all(screens.map((url, index) => new Promise((resolve, reject) => {
    loader.load(url, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures[index] = texture;
      resolve();
    }, undefined, reject);
  })));

  const target = { x: 0, y: 0, h: 0.6, rx: 0, ry: 0, rz: 0 };
  const current = { ...target };
  const screen = { a: 0, b: 3, mix: 0, scroll: 0 };
  const state = { pointerX: 0, pointerY: 0, tiltX: 0, tiltY: 0, running: false, frame: 0, time: 0, last: 0, width: 1, height: 1 };

  const windowFor = (texture, scroll) => {
    // Show a screen-shaped window of the print, moving down by `scroll` (0..1 of the free space).
    const aspect = SCREEN.width / SCREEN.height;
    const visible = Math.min(1, (texture.image.width / aspect) / texture.image.height);
    texture.repeat.set(1, visible);
    texture.offset.set(0, (1 - visible) * (1 - scroll));
  };
  const applyScreen = (mesh, index, scroll) => {
    const texture = textures[index];
    if (!texture) return;
    if (mesh.material.map !== texture) {
      mesh.material.map = texture;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
    }
    windowFor(texture, scroll);
  };

  const viewHeight = () => 2 * DISTANCE * Math.tan(MathUtils.degToRad(FOV / 2));
  const update = (delta) => {
    // Frame-rate independent easing toward the target pose.
    const follow = 1 - Math.exp(-delta * 9);
    for (const key of Object.keys(current)) current[key] += (target[key] - current[key]) * follow;
    state.tiltX += (state.pointerY * 0.12 - state.tiltX) * 0.06;
    state.tiltY += (state.pointerX * 0.18 - state.tiltY) * 0.06;
    const idle = Math.sin(state.time * 0.9);
    const height = viewHeight();
    const width = height * (state.width / state.height);
    pivot.position.set(current.x * width, current.y * height + idle * 0.02, 0);
    pivot.scale.setScalar(Math.max(0.0001, (current.h * height) / BODY.height));
    phone.rotation.set(current.rx + state.tiltX, current.ry + state.tiltY + idle * 0.03, current.rz);
    applyScreen(screenA, screen.a, screen.scroll);
    applyScreen(screenB, screen.b, 0);
    screenB.material.opacity = screen.mix;
    screenB.visible = screen.mix > 0.01;
    const position = sparkGeometry.attributes.position;
    seeds.forEach((seed, index) => {
      seed.y += seed.speed * delta;
      if (seed.y > 1.6) seed.y = -1.6;
      position.setXYZ(index, seed.x + Math.sin(state.time * 0.4 + index) * 0.05, seed.y, seed.z);
    });
    position.needsUpdate = true;
  };

  const render = (now = performance.now()) => {
    const delta = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0.016;
    state.last = now;
    state.time += delta;
    update(delta);
    renderer.render(scene, camera);
  };
  const loop = (now) => {
    if (!state.running) return;
    render(now);
    state.frame = requestAnimationFrame(loop);
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    state.width = width;
    state.height = height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 900 ? 1.5 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!state.running) render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  ready.then(() => { resize(); render(); onReady?.(); }).catch(() => {});

  return {
    ready,
    setTarget(pose) { Object.assign(target, pose); },
    setScreen(a, b, mix, scroll) { Object.assign(screen, { a, b, mix, scroll }); },
    // Skip the easing (first frame, or after a jump through the page).
    jump() { Object.assign(current, target); if (!state.running) render(); },
    pointer(x, y) { state.pointerX = x; state.pointerY = y; },
    start() {
      if (state.running) return;
      state.running = true;
      state.last = 0;
      state.frame = requestAnimationFrame(loop);
    },
    stop() {
      state.running = false;
      cancelAnimationFrame(state.frame);
    },
    dispose() {
      this.stop();
      observer.disconnect();
      textures.forEach((texture) => texture?.dispose());
      scene.traverse((object) => {
        object.geometry?.dispose();
        const material = object.material;
        if (material) {
          material.map?.dispose();
          material.dispose();
        }
      });
      pmrem.dispose();
      renderer.dispose();
    }
  };
}
