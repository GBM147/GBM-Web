// Efeitos de texto da página inicial (usados por public/animations.js), no espírito das
// referências "Texto que evapora" e "Palavras em enxame":
// - evaporar: qualquer bloco (título, parágrafo, botão, campo, lista, linha) vira poeira da
//   esquerda para a direita, cada parte na sua cor, que sobe e some;
// - enxame: os preços dos planos são desenhados por pontos que voam de um preço ao outro,
//   fogem do mouse e estouram no clique.
// O texto continua no HTML (seleção e leitor de tela); os canvas só desenham por cima.
// Tudo é função da rolagem ou de um tempo, então voltar refaz o caminho ao contrário.

const TAU = Math.PI * 2;
const SWEEP = 0.62; // share of a transition the sweep takes to cross the block
const LIFE = 0.42; // how long (in transition progress) a grain of dust lives
const ALPHA_STEPS = 6; // dust is drawn in a few opacity layers, one path each
const BOX_STEP = 4; // sampling grid for filled boxes (buttons, fields)
const LINE_STEP = 1; // thin lines (underlines, rules) need every pixel
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => t * t * (3 - 2 * t);
// Same "random" value for the same index every time, so scrubbing replays the same dust.
const hash = (index, salt) => {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// "#rrggbb", "rgb(r, g, b)" or "rgba(r, g, b, a)" to [r, g, b, a].
const parseColor = (css) => {
  const hex = css.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return [...[0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16)), 1];
  const parts = css.match(/[\d.]+/g) || ["237", "232", "223"];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2]), parts.length > 3 ? Number(parts[3]) : 1];
};

// Visible on screen, up to the block (opacity is not inherited, so the walk checks each level).
function shown(element, root) {
  for (let node = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) return false;
    if (node === root) break;
  }
  return true;
}

// Points of everything drawn by `roots`, relative to `origin`: filled boxes and borders first,
// then the text, word by word, at the place and in the font the browser used. Each part is
// painted in a code (red = its color, green = its sampling grid) and read back as points.
function sampleBlocks(roots, origin, { limit, hidden = false, textStep = 0 }) {
  const rects = roots.map((root) => root.getBoundingClientRect()).filter((rect) => rect.width && rect.height);
  if (!rects.length) return null;
  const pad = 24;
  const left = Math.floor(Math.min(...rects.map((rect) => rect.left)) - pad);
  const top = Math.floor(Math.min(...rects.map((rect) => rect.top)) - pad);
  const width = Math.min(4096, Math.ceil(Math.max(...rects.map((rect) => rect.right)) + pad - left));
  const height = Math.min(4096, Math.ceil(Math.max(...rects.map((rect) => rect.bottom)) + pad - top));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const colors = [];
  const code = (rgb, step) => {
    const key = `${rgb[0]},${rgb[1]},${rgb[2]}`;
    let index = colors.findIndex((color) => color.key === key);
    if (index < 0) index = colors.push({ key, rgb: rgb.slice(0, 3) }) - 1;
    return `rgb(${index + 1}, ${step}, 0)`;
  };
  const points = [];
  const collect = () => {
    const data = context.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * 4;
        if (data[at + 3] < 110) continue;
        const step = data[at + 1] || 2;
        if (x % step || y % step) continue;
        points.push(x + left - origin.left, y + top - origin.top, data[at] - 1);
      }
    }
    context.clearRect(0, 0, width, height);
  };
  const skip = (element) => element.closest("svg, .sr-only, option, script, style");

  // 1. Filled boxes and borders: buttons, fields, underlines and small rules turn to dust too.
  for (const root of roots) {
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (skip(element) || (!hidden && !shown(element, root))) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const style = getComputedStyle(element);
      const x = rect.left - left;
      const y = rect.top - top;
      const background = parseColor(style.backgroundColor);
      // Dark fills (fields, cards) would only smear the dark page; they just get swept away.
      const light = (0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2]) / 255;
      if (background[3] > 0.25 && light > 0.14) {
        const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, rect.width / 2, rect.height / 2);
        context.fillStyle = code(background, BOX_STEP);
        context.beginPath();
        if (context.roundRect) context.roundRect(x, y, rect.width, rect.height, radius);
        else context.rect(x, y, rect.width, rect.height);
        context.fill();
      }
      for (const side of ["Top", "Right", "Bottom", "Left"]) {
        const size = parseFloat(style[`border${side}Width`]) || 0;
        const color = parseColor(style[`border${side}Color`]);
        if (size < 0.5 || color[3] < 0.25 || style[`border${side}Style`] === "none") continue;
        context.fillStyle = code(color, LINE_STEP);
        if (side === "Top") context.fillRect(x, y, rect.width, size);
        if (side === "Bottom") context.fillRect(x, y + rect.height - size, rect.width, size);
        if (side === "Left") context.fillRect(x, y, size, rect.height);
        if (side === "Right") context.fillRect(x + rect.width - size, y, size, rect.height);
      }
    }
  }
  collect();

  // 2. The text.
  const tracks = "letterSpacing" in context;
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || skip(parent) || (!hidden && !shown(parent, root))) continue;
      const style = getComputedStyle(parent);
      const color = parseColor(style.color);
      if (color[3] < 0.1) continue;
      const fontSize = parseFloat(style.fontSize) || 16;
      const tracking = style.letterSpacing === "normal" ? 0 : parseFloat(style.letterSpacing) || 0;
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if (tracks) context.letterSpacing = `${tracking}px`;
      context.fillStyle = code(color, textStep || (fontSize >= 40 ? 3 : 2));
      const metrics = context.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
      const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
      const pattern = /\S+/g;
      for (let word = pattern.exec(node.textContent); word; word = pattern.exec(node.textContent)) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        const rect = range.getClientRects()[0];
        if (!rect || !rect.width) continue;
        let text = word[0];
        if (style.textTransform === "uppercase") text = text.toUpperCase();
        else if (style.textTransform === "lowercase") text = text.toLowerCase();
        else if (style.textTransform === "capitalize") text = text[0].toUpperCase() + text.slice(1);
        const baseline = rect.top - top + (rect.height - ascent - descent) / 2 + ascent;
        if (tracks || !tracking) {
          context.fillText(text, rect.left - left, baseline);
        } else {
          let x = rect.left - left;
          for (const letter of text) {
            context.fillText(letter, x, baseline);
            x += context.measureText(letter).width + tracking;
          }
        }
      }
    }
  }
  collect();

  // An even, repeatable subset when there are too many.
  let list = points;
  const total = points.length / 3;
  if (total > limit) {
    list = [];
    const every = total / limit;
    for (let i = 0; i < limit; i++) {
      const at = Math.floor(i * every) * 3;
      list.push(points[at], points[at + 1], points[at + 2]);
    }
  }
  return {
    points: Float32Array.from(list),
    colors: colors.map((color) => color.rgb),
    box: { left: left - origin.left, top: top - origin.top, width, height }
  };
}

// ---------- Evaporar ----------
// host: the element the dust is drawn over (a pinned stage). fixed: one canvas over the
// viewport, in page coordinates, for blocks that scroll freely.
export function createEvaporator(host, { small = false, fixed = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = fixed ? "fx-canvas is-fixed" : "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  (fixed ? document.body : host).append(canvas);
  const context = canvas.getContext("2d");
  const limit = small ? 4500 : 9000;
  const grain = small ? 1.4 : 1.8;
  const groups = new Set();
  let ratio = 1;
  let frame = 0;
  const origin = () => (fixed ? { left: -window.scrollX, top: -window.scrollY } : host.getBoundingClientRect());
  const fit = () => {
    const box = fixed ? { width: window.innerWidth, height: window.innerHeight } : host.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * ratio));
    canvas.height = Math.max(1, Math.round(box.height * ratio));
  };
  fit();

  const draw = () => {
    frame = 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const shiftX = fixed ? -window.scrollX : 0;
    const shiftY = fixed ? -window.scrollY : 0;
    context.setTransform(ratio, 0, 0, ratio, shiftX * ratio, shiftY * ratio);
    const time = performance.now() / 1000;
    let moving = false;
    for (const group of groups) {
      const { t, sample } = group;
      if (t <= 0 || t >= 1 || !sample) continue;
      moving = true;
      const { points, colors, box } = sample;
      const layers = new Map();
      for (let i = 0, count = points.length / 3; i < count; i++) {
        const x = points[i * 3];
        const y = points[i * 3 + 1];
        const age = (t - ((x - box.left) / box.width) * SWEEP) / LIFE;
        if (age <= 0 || age >= 1) continue;
        const phase = hash(i, 3) * TAU;
        const drift = (16 + hash(i, 1) * 64) * age + Math.sin(age * 5 + phase) * 14 * age;
        const rise = (22 + hash(i, 2) * 96) * age + 44 * age * age;
        const wobble = Math.sin(time * 1.6 + phase) * 2.5 * age;
        const fade = Math.pow(1 - age, 1.3);
        const key = points[i * 3 + 2] * ALPHA_STEPS + Math.min(ALPHA_STEPS - 1, Math.floor(fade * ALPHA_STEPS));
        let path = layers.get(key);
        if (!path) layers.set(key, (path = new Path2D()));
        const size = grain * (0.55 + 0.45 * fade);
        path.rect(x + drift + wobble, y - rise, size, size);
      }
      for (const [key, path] of layers) {
        const [r, g, b] = colors[Math.floor(key / ALPHA_STEPS)] || colors[0];
        context.globalAlpha = (((key % ALPHA_STEPS) + 0.5) / ALPHA_STEPS) * 0.95;
        context.fillStyle = `rgb(${r} ${g} ${b})`;
        context.fill(path);
      }
    }
    context.globalAlpha = 1;
    // Keep the dust breathing while a transition is halfway.
    if (moving) frame = requestAnimationFrame(draw);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
  const unmask = (element) => {
    element.classList.remove("fx-evaporate");
    element.style.removeProperty("--fx-a");
    element.style.removeProperty("--fx-b");
  };

  return {
    // Blocks that leave together, swept left to right as one: set(t), 0 = whole, 1 = gone.
    group(elements) {
      const group = { elements: elements.filter(Boolean), t: 0, sample: null };
      groups.add(group);
      return {
        set(value) {
          const t = clamp01(value);
          group.t = t;
          if (t <= 0) {
            group.sample = null; // measured again at the next transition
            group.elements.forEach(unmask);
            schedule();
            return;
          }
          if (t < 1 && !group.sample) group.sample = sampleBlocks(group.elements, origin(), { limit });
          // Hide what the sweep has passed (a soft edge, covered by the dust): reads first, then writes.
          const from = origin();
          const box = group.sample?.box;
          const sweep = box ? box.left + (t / SWEEP) * box.width * 1.04 : 0;
          const lefts = group.elements.map((element) => element.getBoundingClientRect().left - from.left);
          group.elements.forEach((element, index) => {
            const at = t >= 1 || !box ? 1e5 : sweep - lefts[index];
            element.classList.add("fx-evaporate");
            element.style.setProperty("--fx-a", `${(at - 28).toFixed(1)}px`);
            element.style.setProperty("--fx-b", `${(at + 4).toFixed(1)}px`);
          });
          schedule();
        }
      };
    },
    refresh() {
      fit();
      groups.forEach((group) => { group.sample = null; });
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      canvas.remove();
      groups.forEach((group) => group.elements.forEach(unmask));
      groups.clear();
    }
  };
}

// ---------- Enxame ----------
// words: the elements whose text the swarm draws, in order. set(v): 0 = scattered outside,
// 1 = first word, 2 = second... between them the dots fly from one word to the next; past the
// last word (last + 1) they scatter away again.
export function createSwarm(stage, { words, colors, small = false, signal }) {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const context = canvas.getContext("2d");
  const count = small ? 2200 : 3200;
  const offsets = new Float32Array(count * 4); // x, y offset and their velocity (mouse and click)
  const palette = colors.map(parseColor);
  let ratio = 1;
  let width = 0;
  let height = 0;
  let targets = null;
  let box = null;
  let value = 0;
  let frame = 0;
  let pointer = null;
  const fit = () => {
    const rect = stage.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
  };
  fit();

  const build = () => {
    // Measured with the real numbers showing (the swarm hides them while it draws).
    const on = stage.classList.contains("fx-swarm-on");
    stage.classList.remove("fx-swarm-on");
    const origin = stage.getBoundingClientRect();
    const samples = words.map((element) => sampleBlocks([element], origin, { limit: count, hidden: true, textStep: 2 }));
    if (on) stage.classList.add("fx-swarm-on");
    if (samples.some((sample) => !sample || !sample.points.length)) return false;
    targets = samples.map(({ points }) => {
      const total = points.length / 3;
      const list = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
        const at = Math.floor(hash(i, 11) * total) * 3;
        list[i * 2] = points[at];
        list[i * 2 + 1] = points[at + 1];
      }
      return list;
    });
    const boxes = samples.map((sample) => sample.box);
    box = {
      left: Math.min(...boxes.map((b) => b.left)),
      top: Math.min(...boxes.map((b) => b.top)),
      right: Math.max(...boxes.map((b) => b.left + b.width)),
      bottom: Math.max(...boxes.map((b) => b.top + b.height))
    };
    return true;
  };
  // Where each dot waits before the first word and goes after the last: outside, all around.
  const scattered = (i) => {
    const angle = hash(i, 21) * TAU;
    const radius = Math.hypot(width, height) * (0.55 + hash(i, 22) * 0.35);
    return [width * 0.6 + Math.cos(angle) * radius, height * 0.5 + Math.sin(angle) * radius];
  };

  const draw = () => {
    frame = 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!targets) return;
    const last = words.length;
    const v = Math.min(Math.max(value, 0), last + 1);
    const leaving = v > last;
    const k = leaving ? last - 1 : Math.min(Math.floor(v), last - 1);
    const f = leaving ? v - last : v - k;
    const from = leaving ? targets[last - 1] : k === 0 ? null : targets[k - 1];
    const to = leaving ? null : targets[k];
    const colorFrom = palette[Math.min(leaving ? last - 1 : Math.max(0, k - 1), palette.length - 1)];
    const colorTo = palette[Math.min(leaving ? last - 1 : k, palette.length - 1)];
    const size = small ? 2.2 : 2;
    let settling = false;
    // A few layers by progress keep the color and opacity changes cheap.
    const buckets = 6;
    const paths = Array.from({ length: buckets }, () => new Path2D());
    const used = new Array(buckets).fill(false);
    for (let i = 0; i < count; i++) {
      const delay = hash(i, 31) * 0.38;
      const e = smooth(clamp01((f - delay) / 0.62));
      const [ax, ay] = from ? [from[i * 2], from[i * 2 + 1]] : scattered(i);
      const [bx, by] = to ? [to[i * 2], to[i * 2 + 1]] : scattered(i);
      // Curved flight: a control point pushed sideways and up.
      const mx = (ax + bx) / 2 + (hash(i, 32) - 0.5) * 260;
      const my = (ay + by) / 2 - 60 - hash(i, 33) * 140;
      const u = 1 - e;
      let x = u * u * ax + 2 * u * e * mx + e * e * bx;
      let y = u * u * ay + 2 * u * e * my + e * e * by;
      // Mouse and click: springs pulling each dot back to its place.
      const o = i * 4;
      let fx = 0;
      let fy = 0;
      if (pointer) {
        const dx = x + offsets[o] - pointer.x;
        const dy = y + offsets[o + 1] - pointer.y;
        const distance = Math.hypot(dx, dy);
        const reach = small ? 60 : 90;
        if (distance < reach && distance > 0.01) {
          const push = (1 - distance / reach) * (small ? 30 : 46);
          fx = (dx / distance) * push;
          fy = (dy / distance) * push;
        }
      }
      offsets[o + 2] = (offsets[o + 2] + (fx - offsets[o]) * 0.12) * 0.8;
      offsets[o + 3] = (offsets[o + 3] + (fy - offsets[o + 1]) * 0.12) * 0.8;
      offsets[o] += offsets[o + 2];
      offsets[o + 1] += offsets[o + 3];
      if (Math.abs(offsets[o]) + Math.abs(offsets[o + 1]) + Math.abs(offsets[o + 2]) + Math.abs(offsets[o + 3]) > 0.05) settling = true;
      x += offsets[o];
      y += offsets[o + 1];
      const bucket = Math.min(buckets - 1, Math.floor(e * buckets));
      paths[bucket].rect(x, y, size, size);
      used[bucket] = true;
    }
    for (let bucket = 0; bucket < buckets; bucket++) {
      if (!used[bucket]) continue;
      const mix = (bucket + 0.5) / buckets;
      const r = Math.round(colorFrom[0] + (colorTo[0] - colorFrom[0]) * mix);
      const g = Math.round(colorFrom[1] + (colorTo[1] - colorFrom[1]) * mix);
      const b = Math.round(colorFrom[2] + (colorTo[2] - colorFrom[2]) * mix);
      context.fillStyle = `rgb(${r} ${g} ${b})`;
      context.globalAlpha = !from ? 0.35 + 0.6 * mix : !to ? 0.95 * (1 - 0.9 * mix) : 0.95;
      context.fill(paths[bucket]);
    }
    context.globalAlpha = 1;
    if (settling || pointer) frame = requestAnimationFrame(draw);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };

  const local = (event) => {
    const origin = stage.getBoundingClientRect();
    return { x: event.clientX - origin.left, y: event.clientY - origin.top };
  };
  const formed = () => targets && value > 0.5 && value < words.length + 0.3;
  const near = (point) => formed() && point.x > box.left - 60 && point.x < box.right + 60 && point.y > box.top - 60 && point.y < box.bottom + 60;
  window.addEventListener("pointermove", (event) => {
    if (!formed()) return;
    const point = local(event);
    pointer = near(point) ? point : null;
    if (pointer) schedule();
  }, { signal });
  // A click on the number scatters it; the springs bring the dots back.
  window.addEventListener("click", (event) => {
    if (!formed() || (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, label"))) return;
    if (!near(local(event))) return;
    for (let i = 0; i < count; i++) {
      const angle = hash(i, 41) * TAU;
      const speed = 8 + hash(i, 42) * 26;
      offsets[i * 4 + 2] += Math.cos(angle) * speed;
      offsets[i * 4 + 3] += Math.sin(angle) * speed - 6;
    }
    schedule();
  }, { signal });

  return {
    set(v) {
      value = v;
      if (!targets && v > 0) build();
      stage.classList.toggle("fx-swarm-on", Boolean(targets));
      schedule();
    },
    refresh() {
      fit();
      targets = null;
      if (value > 0) build();
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      canvas.remove();
      stage.classList.remove("fx-swarm-on");
    }
  };
}
