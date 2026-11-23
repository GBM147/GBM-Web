// Efeitos de texto das cenas fixadas (usados por animations.js):
// - evaporar: o título que sai vira poeira da esquerda para a direita, que sobe e some;
// - enxame: os preços dos planos são desenhados por pontos que voam de um preço ao outro,
//   fogem do mouse e estouram no clique.
// O texto continua no HTML (seleção e leitor de tela); os canvas só desenham por cima.
// Tudo é função da rolagem: voltar a rolagem refaz o caminho ao contrário.

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => t * t * (3 - 2 * t);
// Same "random" value for the same index every time, so scrubbing replays the same dust.
const hash = (index, salt) => {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// "#rrggbb" or "rgb(r, g, b)" to [r, g, b].
const parseColor = (css) => {
  const hex = css.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16));
  const match = css.match(/\d+(\.\d+)?/g) || [237, 232, 223];
  return [Number(match[0]), Number(match[1]), Number(match[2])];
};

function makeCanvas(stage) {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const context = canvas.getContext("2d");
  let ratio = 1;
  let width = 0;
  let height = 0;
  const fit = () => {
    const box = stage.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = box.width;
    height = box.height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
  };
  fit();
  return {
    canvas,
    context,
    fit,
    clear() {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    size: () => ({ width, height })
  };
}

// Points inside the glyphs of `elements`, relative to the stage. Each text node is drawn word by
// word at the place the browser laid it out, in its own font, so the dust matches the letters.
function sampleText(elements, stage, { step, limit, hidden = false }) {
  const origin = stage.getBoundingClientRect();
  const boxes = elements.map((element) => element.getBoundingClientRect()).filter((box) => box.width && box.height);
  if (!boxes.length) return null;
  const left = Math.floor(Math.min(...boxes.map((box) => box.left)) - 24);
  const top = Math.floor(Math.min(...boxes.map((box) => box.top)) - 24);
  const width = Math.ceil(Math.max(...boxes.map((box) => box.right)) + 24 - left);
  const height = Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + 24 - top);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const colors = [];
  context.textBaseline = "alphabetic";
  for (const element of elements) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest(".sr-only")) continue;
      const style = getComputedStyle(parent);
      // The swarm also draws prices of plans that are still hidden (they arrive later).
      if (style.display === "none" || (!hidden && style.visibility === "hidden")) continue;
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ("letterSpacing" in context) context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      let colorIndex = colors.indexOf(style.color);
      if (colorIndex < 0) colorIndex = colors.push(style.color) - 1;
      // The color index rides in the red channel; the real color is looked up later.
      context.fillStyle = `rgb(${colorIndex + 1}, 0, 0)`;
      const pattern = /\S+/g;
      let word;
      while ((word = pattern.exec(node.textContent))) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        const rect = range.getClientRects()[0];
        if (!rect || !rect.width) continue;
        const metrics = context.measureText(word[0]);
        const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8;
        const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * 0.2;
        const baseline = rect.top - top + (rect.height - ascent - descent) / 2 + ascent;
        context.fillText(word[0], rect.left - left, baseline);
      }
    }
  }
  const data = context.getImageData(0, 0, width, height).data;
  const points = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      if (data[index + 3] > 140) points.push([x + left - origin.left, y + top - origin.top, Math.max(0, data[index] - 1)]);
    }
  }
  // An even, repeatable subset when there are too many.
  if (points.length > limit) {
    const keep = [];
    const every = points.length / limit;
    for (let i = 0; i < limit; i++) keep.push(points[Math.floor(i * every)]);
    points.length = 0;
    points.push(...keep);
  }
  return {
    points,
    colors: colors.map(parseColor),
    box: { left: left - origin.left, top: top - origin.top, width, height }
  };
}

// ---------- Evaporar ----------
const SWEEP = 0.62; // share of the transition the sweep takes to cross the title
const LIFE = 0.42; // how long (in transition progress) a grain of dust lives

export function createEvaporator(stage, { small = false } = {}) {
  const layer = makeCanvas(stage);
  const groups = [];
  let frame = 0;
  const draw = () => {
    frame = 0;
    layer.clear();
    const context = layer.context;
    const time = performance.now() / 1000;
    let moving = false;
    for (const group of groups) {
      const t = group.t;
      if (t <= 0 || t >= 1 || !group.sample) continue;
      moving = true;
      const { points, colors, box } = group.sample;
      const fills = colors.map(([r, g, b]) => `rgb(${r} ${g} ${b})`);
      for (let i = 0; i < points.length; i++) {
        const [x, y, c] = points[i];
        const age = (t - ((x - box.left) / box.width) * SWEEP) / LIFE;
        if (age <= 0 || age >= 1) continue;
        const a = hash(i, 1);
        const b = hash(i, 2);
        const phase = hash(i, 3) * TAU;
        const drift = (16 + a * 64) * age + Math.sin(age * 5 + phase) * 14 * age;
        const rise = (22 + b * 96) * age + 44 * age * age;
        const wobble = Math.sin(time * 1.6 + phase) * 2.5 * age;
        const size = (small ? 1.3 : 1.7) * (1 - 0.45 * age);
        context.globalAlpha = Math.pow(1 - age, 1.3) * 0.95;
        context.fillStyle = fills[c] || fills[0];
        context.fillRect(x + drift + wobble, y - rise, size, size);
      }
    }
    context.globalAlpha = 1;
    // Keep the dust breathing while a transition is halfway.
    if (moving) frame = requestAnimationFrame(draw);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };

  return {
    // A group of titles that leave together; set(t) with t from 0 (whole) to 1 (gone).
    group(elements) {
      const group = { elements, t: 0, sample: null };
      groups.push(group);
      return {
        set(t) {
          group.t = t;
          if (t > 0 && t < 1 && !group.sample) group.sample = sampleText(elements, stage, { step: small ? 3 : 2, limit: small ? 1400 : 2600 });
          // Hide the letters the sweep has passed (a soft edge, covered by the dust).
          const sweep = group.sample ? group.sample.box.left + (t / SWEEP) * group.sample.box.width * 1.04 : 0;
          const origin = stage.getBoundingClientRect();
          for (const element of elements) {
            if (t <= 0) {
              element.classList.remove("fx-evaporate");
              continue;
            }
            const rect = element.getBoundingClientRect();
            const at = rect.width ? ((sweep + origin.left - rect.left) / rect.width) * 100 : 110;
            element.classList.add("fx-evaporate");
            element.style.setProperty("--fx-a", `${(at - 7).toFixed(2)}%`);
            element.style.setProperty("--fx-b", `${(at + 1).toFixed(2)}%`);
          }
          schedule();
        }
      };
    },
    refresh() {
      layer.fit();
      groups.forEach((group) => { group.sample = null; });
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      layer.canvas.remove();
      groups.forEach((group) => group.elements.forEach((element) => {
        element.classList.remove("fx-evaporate");
        element.style.removeProperty("--fx-a");
        element.style.removeProperty("--fx-b");
      }));
    }
  };
}

// ---------- Enxame ----------
// words: the elements whose text the swarm draws, in order. set(v): 0 = scattered outside,
// 1 = first word, 2 = second... in between, the dots are flying from one word to the next.
export function createSwarm(stage, { words, colors, small = false, signal }) {
  const layer = makeCanvas(stage);
  const count = small ? 2200 : 3200;
  let targets = null;
  let box = null;
  let value = 0;
  let frame = 0;
  const offsets = new Float32Array(count * 4); // x, y offset and their velocity (mouse and click)
  let pointer = null;
  let active = false;
  const palette = colors.map(parseColor);

  const build = () => {
    const samples = words.map((element) => sampleText([element], stage, { step: 2, limit: count, hidden: true }));
    if (samples.some((sample) => !sample || !sample.points.length)) return false;
    targets = samples.map(({ points }) => {
      const list = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
        const point = points[Math.floor(hash(i, 11) * points.length)] || points[i % points.length];
        list[i * 2] = point[0];
        list[i * 2 + 1] = point[1];
      }
      return list;
    });
    const all = samples.map((sample) => sample.box);
    const left = Math.min(...all.map((b) => b.left));
    const top = Math.min(...all.map((b) => b.top));
    box = { left, top, right: Math.max(...all.map((b) => b.left + b.width)), bottom: Math.max(...all.map((b) => b.top + b.height)) };
    return true;
  };
  // Where each dot waits before the first word: outside the stage, all around.
  const scattered = (i) => {
    const { width, height } = layer.size();
    const angle = hash(i, 21) * TAU;
    const radius = Math.hypot(width, height) * (0.55 + hash(i, 22) * 0.35);
    return [width * 0.6 + Math.cos(angle) * radius, height * 0.5 + Math.sin(angle) * radius];
  };

  const draw = () => {
    frame = 0;
    layer.clear();
    if (!targets) return;
    const context = layer.context;
    const last = words.length;
    const v = Math.min(Math.max(value, 0), last);
    const k = Math.min(Math.floor(v), last - 1);
    const f = v - k;
    const from = k === 0 ? null : targets[k - 1];
    const to = targets[k];
    const colorFrom = palette[Math.max(0, k - 1)];
    const colorTo = palette[Math.min(k, palette.length - 1)];
    const size = small ? 2.2 : 2;
    let settling = false;
    // A few color buckets keep the number of fillStyle changes small.
    const buckets = 6;
    const paths = Array.from({ length: buckets }, () => []);
    for (let i = 0; i < count; i++) {
      const delay = hash(i, 31) * 0.38;
      const e = smooth(clamp01((f - delay) / 0.62));
      const [ax, ay] = from ? [from[i * 2], from[i * 2 + 1]] : scattered(i);
      const bx = to[i * 2];
      const by = to[i * 2 + 1];
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
      paths[Math.min(buckets - 1, Math.floor(e * buckets))].push(x, y);
    }
    for (let bucket = 0; bucket < buckets; bucket++) {
      const list = paths[bucket];
      if (!list.length) continue;
      const mix = from ? (bucket + 0.5) / buckets : 1;
      const r = Math.round(colorFrom[0] + (colorTo[0] - colorFrom[0]) * mix);
      const g = Math.round(colorFrom[1] + (colorTo[1] - colorFrom[1]) * mix);
      const b = Math.round(colorFrom[2] + (colorTo[2] - colorFrom[2]) * mix);
      context.fillStyle = `rgb(${r} ${g} ${b})`;
      context.globalAlpha = from ? 0.95 : 0.35 + 0.6 * ((bucket + 0.5) / buckets);
      for (let j = 0; j < list.length; j += 2) context.fillRect(list[j], list[j + 1], size, size);
    }
    context.globalAlpha = 1;
    if (settling || pointer) frame = requestAnimationFrame(draw);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };

  const local = (event) => {
    const origin = stage.getBoundingClientRect();
    return { x: event.clientX - origin.left, y: event.clientY - origin.top };
  };
  const near = (point) => box && value > 0.5 && point.x > box.left - 60 && point.x < box.right + 60 && point.y > box.top - 60 && point.y < box.bottom + 60;
  window.addEventListener("pointermove", (event) => {
    if (!active) return;
    const point = local(event);
    pointer = near(point) ? point : null;
    if (pointer) schedule();
  }, { signal });
  // A click on the number scatters it; the springs bring the dots back.
  window.addEventListener("click", (event) => {
    if (!active || !targets || (event.target instanceof Element && event.target.closest("a, button"))) return;
    const point = local(event);
    if (!near(point)) return;
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
      active = Boolean(targets) && v > 0;
      stage.classList.toggle("fx-swarm-on", Boolean(targets));
      schedule();
    },
    refresh() {
      layer.fit();
      targets = null;
      if (value > 0) build();
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      layer.canvas.remove();
      stage.classList.remove("fx-swarm-on");
    }
  };
}
