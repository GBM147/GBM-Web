// Cena 3D da página: um celular modelado no código que acompanha a rolagem pela
// página inteira (topo, planos e contato). A coreografia fica em public/animations.js,
// que passa uma pose alvo; aqui a cena só chega nela de forma suave.
// Empacotado por scripts/build-netlify.js em public/vendor/hero3d.js.
import {
  AdditiveBlending, AmbientLight, BackSide, BoxGeometry, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Group, LinearFilter, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Points, PointsMaterial, Scene, SRGBColorSpace,
  TextureLoader, WebGLRenderer, ACESFilmicToneMapping, MathUtils
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Measures of public/assets/3d/phone.glb (modeled in art/phone.py).
const BODY = { width: 1, height: 2.06, depth: 0.105 };
const SCREEN = { width: 0.93, height: 1.99 };
const FOV = 30;
const DISTANCE = 7;

// Photo studio used only for reflections: dark room, white softboxes and orange light
// strips (the GBM glow on metal and glass).
function studio() {
  const room = new Scene();
  room.add(new Mesh(new BoxGeometry(12, 12, 12), new MeshBasicMaterial({ color: new Color(0.012, 0.011, 0.01), side: BackSide })));
  const panel = (width, height, color, strength, position) => {
    const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(strength), side: DoubleSide }));
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  panel(4.2, 2.6, "#ffffff", 3.4, [-2.6, 3.2, 3.2]);
  panel(2.4, 1.8, "#fff4ea", 1.1, [3.2, 1.2, 2.8]);
  panel(0.4, 7, "#ff5a1f", 7, [-3.8, 0, -1.4]);
  panel(0.4, 7, "#ff8c4a", 4.5, [3.8, 0.4, -1.8]);
  panel(6, 0.35, "#ffffff", 1.4, [0, -3.6, 1.2]);
  return room;
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
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
export function createPhoneScene(canvas, { screens, modelUrl = "/assets/3d/phone.glb", onReady } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  // Near plane close to the phone: phones with a 16-bit depth buffer otherwise draw stripes where
  // the island, the screen layers and the glass sit a hair apart.
  const camera = new PerspectiveCamera(FOV, 1, 3, 14);
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

  const metal = new MeshPhysicalMaterial({ color: new Color("#5b5953"), metalness: 1, roughness: 0.3, anisotropy: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.2 });
  const materials = {
    Frame: metal,
    Buttons: metal,
    LensRing: new MeshPhysicalMaterial({ color: new Color("#3b3a36"), metalness: 1, roughness: 0.22 }),
    Glass: new MeshPhysicalMaterial({ color: new Color("#050505"), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }),
    Island: new MeshBasicMaterial({ color: 0x020202, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
    Back: new MeshPhysicalMaterial({ map: backTexture(), metalness: 0.15, roughness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.35 }),
    Plateau: new MeshPhysicalMaterial({ color: new Color("#22211e"), metalness: 0.3, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    LensGlass: new MeshPhysicalMaterial({ color: new Color("#090c13"), roughness: 0.02, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.6 }),
    Flash: new MeshPhysicalMaterial({ color: new Color("#efe3c6"), roughness: 0.3 }),
    Port: new MeshBasicMaterial({ color: 0x050505 }),
    Speaker: new MeshBasicMaterial({ color: 0x050505 })
  };
  const screenA = new Mesh(undefined, new MeshBasicMaterial({ color: 0x111111, toneMapped: false }));
  const screenB = new Mesh(undefined, new MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false }));
  // Cover glass: only its reflections are added on top of the display.
  const cover = new Mesh(undefined, new MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, clearcoat: 1, transparent: true, blending: AdditiveBlending, depthWrite: false, envMapIntensity: 0.9 }));
  const model = new Promise((resolve, reject) => {
    new GLTFLoader().load(modelUrl, (gltf) => {
      gltf.scene.traverse((object) => {
        if (!object.isMesh) return;
        if (object.name === "Screen") {
          for (const [layer, lift] of [[screenA, 0], [screenB, 0.0004], [cover, 0.0008]]) {
            layer.geometry = object.geometry;
            layer.position.copy(object.position);
            layer.position.z += lift;
            phone.add(layer);
          }
          object.visible = false;
        } else if (materials[object.name]) {
          object.material = materials[object.name];
        }
      });
      phone.add(gltf.scene);
      resolve();
    }, undefined, reject);
  });

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
  const ready = Promise.all([model, ...screens.map((url, index) => new Promise((resolve, reject) => {
    loader.load(url, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.flipY = false;
      texture.minFilter = LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures[index] = texture;
      resolve();
    }, undefined, reject);
  }))]);

  const target = { x: 0, y: 0, h: 0.6, rx: 0, ry: 0, rz: 0 };
  const current = { ...target };
  const screen = { a: 0, b: 3, mix: 0, scroll: 0 };
  const state = { pointerX: 0, pointerY: 0, tiltX: 0, tiltY: 0, running: false, frame: 0, time: 0, last: 0, width: 1, height: 1 };

  const windowFor = (texture, scroll) => {
    // Show a screen-shaped window of the print, moving down by `scroll` (0..1 of the free space).
    const aspect = SCREEN.width / SCREEN.height;
    const visible = Math.min(1, (texture.image.width / aspect) / texture.image.height);
    texture.repeat.set(1, visible);
    texture.offset.set(0, (1 - visible) * scroll);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 900 ? 2 : 1.75));
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
    // The eased pose as it is drawn (used to move the page glow with the phone).
    current: () => current,
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
