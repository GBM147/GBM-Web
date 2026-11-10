const registeredEngines = new WeakSet();

// Each segment drives the live hero: the page in the browser, the chat on the phone and the sphere colors.
const SEGMENTS = [
  {
    name: "Época Barbearia", plural: "barbearias", initial: "É", url: "epoca.barbearia",
    message: "Oi! Vi o site de vocês. Tem horário hoje às 18h?", reply: "Tem sim! Já deixei reservado ✂️",
    colors: ["#ffbf86", "#f98544", "#e15c2d", "#b73511", "#7b2912"], accent: "#e65a32"
  },
  {
    name: "Terra & Mesa", plural: "restaurantes", initial: "T", url: "terraemesa.restaurante",
    message: "Boa noite! Quero pedir 2 pratos do dia 😋", reply: "Anotado! Sai em 30 minutos 🛵",
    colors: ["#e6efb8", "#adc176", "#73884a", "#4a5c2e", "#29351b"], accent: "#73884a"
  },
  {
    name: "Pata Club", plural: "pet shops", initial: "P", url: "pataclub.petshop",
    message: "Oi! Quero agendar banho e tosa pro Thor 🐶", reply: "Agendado: amanhã às 10h 💜",
    colors: ["#ecdcff", "#bf93ea", "#9360cc", "#66349d", "#3c1c60"], accent: "#9360cc"
  }
];
const SPHERE_VARS = ["--sp1", "--sp2", "--sp3", "--sp4", "--sp5", "--live-accent"];

// Splits text into inline-block characters for the title intro; the visible title is aria-hidden.
function splitChars(nodes) {
  const originals = [...nodes].map((node) => [node, node.innerHTML]);
  const chars = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        for (const letter of child.textContent) {
          if (/\s/.test(letter)) { fragment.append(document.createTextNode(letter)); continue; }
          const span = document.createElement("span");
          span.className = "char";
          span.textContent = letter;
          fragment.append(span);
          chars.push(span);
        }
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.namespaceURI !== "http://www.w3.org/2000/svg") {
        walk(child);
      }
    });
  };
  nodes.forEach(walk);
  return { chars, restore: () => originals.forEach(([node, html]) => { node.innerHTML = html; }) };
}

// Wraps each word of a heading in a mask so it can slide up; restore() puts the original markup back.
function splitWords(heading) {
  const original = heading.innerHTML;
  const wrap = (node) => {
    const outer = document.createElement("span");
    const inner = document.createElement("span");
    outer.className = "w";
    inner.append(node);
    outer.append(inner);
    return outer;
  };
  const walk = (parent) => {
    [...parent.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          fragment.append(/^\s+$/.test(part) ? document.createTextNode(part) : wrap(document.createTextNode(part)));
        });
        child.replaceWith(fragment);
      } else if (child.nodeName === "EM") {
        walk(child);
      }
    });
  };
  walk(heading);
  return { words: heading.querySelectorAll(".w > span"), restore: () => { heading.innerHTML = original; } };
}

// Dot grid behind the hero; with a mouse, dots near the cursor grow and turn orange.
function initDots(hero, interactive) {
  const canvas = hero?.querySelector(".hero-dots");
  const context = canvas?.getContext?.("2d");
  if (!context) return () => {};
  const GAP = 26;
  const RADIUS = 170;
  const OFF = -10000;
  const target = { x: OFF, y: OFF };
  const position = { x: OFF, y: OFF };
  const listeners = new AbortController();
  let width = 0;
  let height = 0;
  let frame = 0;
  const draw = () => {
    context.clearRect(0, 0, width, height);
    context.globalAlpha = .5;
    context.fillStyle = "#c9c2b2";
    context.beginPath();
    for (let x = GAP / 2; x < width; x += GAP) {
      for (let y = GAP / 2; y < height; y += GAP) { context.moveTo(x + 1, y); context.arc(x, y, 1, 0, Math.PI * 2); }
    }
    context.fill();
    if (position.x > OFF / 2) {
      context.fillStyle = "#e65a32";
      const startX = Math.max(GAP / 2, Math.floor((position.x - RADIUS) / GAP) * GAP + GAP / 2);
      const startY = Math.max(GAP / 2, Math.floor((position.y - RADIUS) / GAP) * GAP + GAP / 2);
      for (let x = startX; x < Math.min(width, position.x + RADIUS); x += GAP) {
        for (let y = startY; y < Math.min(height, position.y + RADIUS); y += GAP) {
          const strength = 1 - Math.hypot(x - position.x, y - position.y) / RADIUS;
          if (strength <= 0) continue;
          context.globalAlpha = Math.min(1, strength * 1.1);
          context.beginPath();
          context.arc(x, y, 1 + strength * 2.4, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    context.globalAlpha = 1;
  };
  const tick = () => {
    position.x += (target.x - position.x) * .2;
    position.y += (target.y - position.y) * .2;
    draw();
    frame = Math.abs(target.x - position.x) + Math.abs(target.y - position.y) > .5 ? requestAnimationFrame(tick) : 0;
  };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(hero);
  if (interactive) {
    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const bounds = hero.getBoundingClientRect();
      target.x = event.clientX - bounds.left;
      target.y = event.clientY - bounds.top;
      if (position.x <= OFF / 2) { position.x = target.x; position.y = target.y; }
      if (!frame) frame = requestAnimationFrame(tick);
    }, { signal: listeners.signal });
    hero.addEventListener("pointerleave", () => {
      target.x = position.x = OFF;
      target.y = position.y = OFF;
      draw();
    }, { signal: listeners.signal });
  }
  return () => {
    listeners.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    context.clearRect(0, 0, width, height);
  };
}

// The browser wipes to the next client site, the URL is typed, the sphere changes color and
// a customer messages the business on the phone. One short timeline per segment, chained.
function createLiveHero(gsap, ScrollTrigger, hero, context, signal) {
  const art = hero.querySelector(".hero-art");
  const slides = [...hero.querySelectorAll("[data-slide]")];
  const url = hero.querySelector("[data-live-url]");
  const names = [...hero.querySelectorAll("[data-live-name]")];
  const initial = hero.querySelector("[data-live-initial]");
  const kicker = hero.querySelector("[data-live-kicker]");
  const incoming = hero.querySelector("[data-live-msg]");
  const reply = hero.querySelector("[data-live-reply]");
  const typing = hero.querySelector(".chat-typing");
  const toast = hero.querySelector(".live-toast");
  if (!art || slides.length !== SEGMENTS.length || !url || !incoming || !reply || !typing || !toast) return null;
  const defaults = { kicker: kicker?.textContent || "", url: url.textContent };
  const apply = (index) => {
    const segment = SEGMENTS[index];
    names.forEach((name) => { name.textContent = segment.name; });
    if (initial) initial.textContent = segment.initial;
    incoming.textContent = segment.message;
    reply.textContent = segment.reply;
  };
  const colors = (segment) => Object.fromEntries(SPHERE_VARS.map((name, index) => [name, index < 5 ? segment.colors[index] : segment.accent]));
  gsap.set([incoming, reply, toast], { autoAlpha: 0 });

  let current = null;
  let started = false;
  let inView = true;
  const update = () => {
    if (!current) return;
    if (started && inView && !document.hidden) current.resume();
    else current.pause();
  };

  const addTransition = (timeline, index) => {
    const segment = SEGMENTS[index];
    const next = slides[index];
    const previous = slides[(index + slides.length - 1) % slides.length];
    const typed = { length: 0 };
    timeline
      .to([incoming, reply, toast], { autoAlpha: 0, duration: .3, ease: "power2.in" }, 0)
      .fromTo(typed, { length: 0 }, {
        length: segment.url.length, duration: .55, ease: "none",
        onUpdate: () => { url.textContent = segment.url.slice(0, Math.round(typed.length)); }
      }, .1)
      .set(previous, { zIndex: 1 }, .3)
      .set(next, { zIndex: 2, visibility: "visible" }, .3)
      .fromTo(next, { clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: .95, ease: "power3.inOut", immediateRender: false }, .3)
      .set(previous, { visibility: "hidden" }, 1.25)
      .to(art, { ...colors(segment), duration: 1, ease: "power2.inOut" }, .3)
      .call(apply, [index], .45);
  };

  const addChat = (timeline, index) => {
    const start = timeline.duration();
    if (kicker) {
      timeline
        .to(kicker, { yPercent: -110, duration: .3, ease: "power2.in" }, start)
        .call(() => { kicker.textContent = SEGMENTS[index].plural; }, null, start + .3)
        .fromTo(kicker, { yPercent: 110 }, { yPercent: 0, duration: .45, ease: "power3.out" }, start + .3);
    }
    timeline
      .to(typing, { autoAlpha: 1, duration: .2 }, start + .2)
      .to(typing, { autoAlpha: 0, duration: .15 }, start + 1.25)
      .fromTo(incoming, { autoAlpha: 0, y: 8, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1, duration: .45, ease: "back.out(1.7)" }, start + 1.3)
      .fromTo(reply, { autoAlpha: 0, y: 8, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1, duration: .45, ease: "back.out(1.7)" }, start + 2.3)
      .fromTo(toast, { autoAlpha: 0, y: 14, scale: .85 }, { autoAlpha: 1, y: 0, scale: 1, duration: .55, ease: "back.out(2)" }, start + 2.7)
      .to({}, { duration: 1.7 });
  };

  const cycle = (index, first) => {
    context.add(() => {
      const timeline = gsap.timeline({ paused: true, onComplete: () => cycle((index + 1) % SEGMENTS.length, false) });
      if (!first) addTransition(timeline, index);
      addChat(timeline, index);
      current?.kill();
      current = timeline;
    });
    update();
  };

  const trigger = ScrollTrigger.create({
    trigger: hero, start: "top bottom", end: "bottom top",
    onToggle: (self) => { inView = self.isActive; update(); }
  });
  inView = trigger.isActive;
  document.addEventListener("visibilitychange", update, { signal });
  cycle(0, true);
  return {
    play: () => { started = true; update(); },
    reset: () => {
      current?.kill();
      current = null;
      apply(0);
      url.textContent = defaults.url;
      if (kicker) kicker.textContent = defaults.kicker;
      SPHERE_VARS.forEach((name) => art.style.removeProperty(name));
      gsap.set([...slides, incoming, reply, typing, toast, kicker].filter(Boolean), { clearProps: "all" });
    }
  };
}

export function initAnimations({ skipIntro = false } = {}) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return () => {};
  if (!registeredEngines.has(gsap)) {
    gsap.registerPlugin(ScrollTrigger);
    registeredEngines.add(gsap);
  }
  const media = gsap.matchMedia();
  const listeners = new AbortController();
  let disposed = false;
  let refreshFrame = 0;
  let introduced = skipIntro;
  const refresh = () => {
    if (disposed || refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      if (!disposed) ScrollTrigger.refresh();
    });
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    listeners.abort();
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    media.revert();
  };
  try {
    media.add({
      isDesktop: "(min-width: 900px)",
      isMobile: "(max-width: 899px)",
      finePointer: "(hover: hover) and (pointer: fine)",
      reduceMotion: "(prefers-reduced-motion: reduce)"
    }, (context) => {
      const { isDesktop, finePointer, reduceMotion } = context.conditions;
      const hero = document.querySelector(".hero");
      const stopDots = initDots(hero, finePointer && !reduceMotion);
      if (reduceMotion) return () => { stopDots(); };
      const localListeners = new AbortController();
      const restorers = [stopDots];
      const live = hero ? createLiveHero(gsap, ScrollTrigger, hero, context, localListeners.signal) : null;
      if (live) restorers.push(live.reset);

      if (!introduced && hero && hero.getBoundingClientRect().bottom > 0) {
        introduced = true;
        const title = splitChars(hero.querySelectorAll(".hero-title .line-inner"));
        restorers.push(title.restore);
        const intro = gsap.timeline({
          defaults: { duration: .7, ease: "power3.out", clearProps: "transform,opacity,visibility" },
          onComplete: () => live?.play()
        });
        intro.addLabel("enter", 0);
        const layerOf = (selector) => hero.querySelector(selector)?.closest(".art-layer");
        const kicker = hero.querySelector(".hero-kicker");
        const spark = hero.querySelector(".title-spark");
        const description = hero.querySelector(".hero-description");
        const actions = hero.querySelector(".hero-actions");
        const note = hero.querySelector(".hero-note");
        const sphere = hero.querySelector(".art-sphere");
        const browser = hero.querySelector(".hero-browser");
        const phone = hero.querySelector(".hero-phone");
        if (kicker) intro.from(kicker, { y: 16, opacity: 0, duration: .5 }, "enter");
        if (title.chars.length) {
          intro.from(title.chars, {
            yPercent: 55, rotationX: -95, opacity: 0, transformOrigin: "50% 100%", transformPerspective: 500,
            stagger: .024, duration: .85, ease: "power4.out"
          }, "enter+=.1");
        }
        if (spark) intro.from(spark, { scale: 0, rotation: -200, opacity: 0, duration: .9, ease: "back.out(2.2)" }, "enter+=.75");
        if (description) intro.from(description, { y: 20, opacity: 0 }, "enter+=.55");
        if (actions) intro.from(actions, { y: 16, opacity: 0 }, "enter+=.7");
        if (note) intro.from(note, { y: 12, opacity: 0 }, "enter+=.8");
        const orbitLayer = layerOf(".art-orbit");
        if (orbitLayer) intro.from(orbitLayer, { opacity: 0, duration: 1.2, clearProps: "opacity" }, "enter+=.15");
        if (sphere) {
          intro.from(sphere.parentElement, {
            scale: .15, opacity: 0, duration: 1.3, ease: "back.out(1.25)", clearProps: "opacity",
            transformOrigin: `${sphere.offsetLeft + sphere.offsetWidth / 2}px ${sphere.offsetTop + sphere.offsetHeight / 2}px`
          }, "enter+=.2");
        }
        const sparkLayer = layerOf(".art-spark");
        if (sparkLayer) intro.from(sparkLayer, { opacity: 0, y: -40, duration: .9, clearProps: "opacity" }, "enter+=.6");
        if (browser) intro.from(browser, { y: 80, rotation: -20, opacity: 0, duration: 1.15, ease: "power4.out" }, "enter+=.35");
        if (phone) intro.from(phone, { x: 90, y: 30, rotation: 28, opacity: 0, duration: 1.15, ease: "power4.out" }, "enter+=.6");
        const labels = [layerOf(".art-label"), hero.querySelector(".art-caption")].filter(Boolean);
        if (labels.length) intro.from(labels, { opacity: 0, duration: .8, clearProps: "opacity" }, "enter+=1");
      } else {
        live?.play();
      }

      // Opacity preserves keyboard access while the reveal is waiting for scroll.
      const reveals = new Map();
      let pointerFocus = false;
      document.querySelectorAll("[data-reveal]").forEach((element) => {
        if (element.closest(".hero") || element.parentElement?.closest("[data-reveal]")) return;
        const tween = gsap.from(element, {
          y: isDesktop ? 28 : 18,
          opacity: 0,
          duration: .8,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: { trigger: element, start: "top 91%", once: true }
        });
        reveals.set(element, tween);
      });
      document.addEventListener("focusin", (event) => {
        // Finishing a transform between pointerdown and click moves the hit target.
        if (pointerFocus) return;
        reveals.forEach((tween, element) => { if (element.contains(event.target)) tween.progress(1); });
      }, { signal: localListeners.signal });
      document.addEventListener("pointerdown", () => { pointerFocus = true; }, { capture: true, signal: localListeners.signal });
      document.addEventListener("keydown", () => { pointerFocus = false; }, { capture: true, signal: localListeners.signal });

      // Headings rise word by word as each section arrives.
      document.querySelectorAll(".section-heading h2, .contact-copy h2").forEach((heading) => {
        const split = splitWords(heading);
        restorers.push(split.restore);
        gsap.from(split.words, {
          yPercent: 115, rotation: 3, duration: .95, ease: "power4.out", stagger: .06,
          scrollTrigger: { trigger: heading, start: "top 88%", once: true }
        });
      });

      // Prices count up when the plans come into view.
      document.querySelectorAll(".price-value strong").forEach((price) => {
        const original = price.textContent;
        const match = original.match(/^(\D*)(\d+)(.*)$/);
        if (!match) return;
        const [, before, value, after] = match;
        const counter = { value: 0 };
        restorers.push(() => { price.textContent = original; });
        gsap.to(counter, {
          value: Number(value), duration: 1.3, ease: "power2.out",
          scrollTrigger: { trigger: price, start: "top 92%", once: true },
          onUpdate: () => { price.textContent = `${before}${Math.round(counter.value)}${after}`; }
        });
      });

      // Plan cards: the light follows the pointer.
      if (finePointer) {
        document.querySelectorAll(".price-card").forEach((card) => {
          card.addEventListener("pointermove", (event) => {
            const bounds = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${event.clientX - bounds.left}px`);
            card.style.setProperty("--my", `${event.clientY - bounds.top}px`);
          }, { signal: localListeners.signal });
        });
      }

      // Thin progress bar for the whole page.
      const progress = document.createElement("div");
      progress.className = "scroll-progress";
      progress.setAttribute("aria-hidden", "true");
      document.body.append(progress);
      restorers.push(() => progress.remove());
      gsap.to(progress, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .3 } });

      // Segment band: runs on its own and speeds up and leans with the scroll.
      const track = document.querySelector(".marquee-track");
      if (track) {
        const loop = gsap.to(track, { xPercent: -50, duration: isDesktop ? 32 : 22, ease: "none", repeat: -1 });
        const skewTo = gsap.quickTo(track, "skewX", { duration: .5, ease: "power3" });
        const settle = () => { gsap.to(loop, { timeScale: 1, duration: .8, overwrite: true }); skewTo(0); };
        ScrollTrigger.create({
          trigger: track.parentElement, start: "top bottom", end: "bottom top",
          onToggle: (self) => { if (self.isActive) loop.resume(); else loop.pause(); },
          onUpdate: (self) => {
            const velocity = self.getVelocity();
            gsap.to(loop, { timeScale: gsap.utils.clamp(1, 5, 1 + Math.abs(velocity) / 350), duration: .25, overwrite: true });
            skewTo(gsap.utils.clamp(-9, 9, velocity / -260));
          }
        });
        ScrollTrigger.addEventListener("scrollEnd", settle);
        restorers.push(() => ScrollTrigger.removeEventListener("scrollEnd", settle));
      }

      const artInner = hero?.querySelector(".hero-art-inner");
      if (isDesktop && artInner) {
        gsap.to(artInner, {
          y: -36,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: .65, invalidateOnRefresh: true }
        });
      }
      const line = document.querySelector(".process-line");
      if (line) {
        gsap.from(line, {
          scaleY: .08,
          transformOrigin: "center top",
          ease: "none",
          scrollTrigger: { trigger: line.parentElement, start: "top 78%", end: "bottom 55%", scrub: .45 }
        });
      }
      if (isDesktop && finePointer) {
        // The hero scene tilts toward the cursor; layers sit at different depths.
        const stage = hero?.querySelector(".art-stage");
        if (stage) {
          gsap.set(stage, { transformPerspective: 1100 });
          hero.querySelectorAll(".art-layer[data-depth]").forEach((layer) => { gsap.set(layer, { z: Number(layer.dataset.depth) * 20 }); });
          const turnY = gsap.quickTo(stage, "rotationY", { duration: .9, ease: "power3" });
          const turnX = gsap.quickTo(stage, "rotationX", { duration: .9, ease: "power3" });
          hero.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse") return;
            const bounds = hero.getBoundingClientRect();
            turnY(((event.clientX - bounds.left) / bounds.width - .5) * 16);
            turnX(-((event.clientY - bounds.top) / bounds.height - .5) * 12);
          }, { signal: localListeners.signal });
          hero.addEventListener("pointerleave", () => { turnY(0); turnX(0); }, { signal: localListeners.signal });
        }
        const loops = [];
        if (hero) {
          hero.querySelectorAll(".orbit-object").forEach((element, index) => {
            loops.push(gsap.to(element, {
              y: index % 2 ? 8 : -8,
              rotation: index % 2 ? -3 : 3,
              duration: 3.4 + index * .45,
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
              paused: true
            }));
          });
        }
        if (loops.length) {
          let inViewport = true;
          const updatePlayback = () => {
            loops.forEach((tween) => {
              if (inViewport && !document.hidden) tween.resume();
              else tween.pause();
            });
          };
          const visibilityTrigger = ScrollTrigger.create({
            trigger: hero,
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => { inViewport = self.isActive; updatePlayback(); }
          });
          inViewport = visibilityTrigger.isActive;
          updatePlayback();
          document.addEventListener("visibilitychange", updatePlayback, { signal: localListeners.signal });
        }
        document.querySelectorAll("[data-magnetic]").forEach((button) => {
          const xTo = gsap.quickTo(button, "x", { duration: .35, ease: "power3.out" });
          const yTo = gsap.quickTo(button, "y", { duration: .35, ease: "power3.out" });
          let bounds = null;
          button.addEventListener("pointerenter", () => { bounds = button.getBoundingClientRect(); }, { signal: localListeners.signal });
          button.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse" || !bounds) return;
            xTo(gsap.utils.clamp(-8, 8, (event.clientX - bounds.left - bounds.width / 2) * .08));
            yTo(gsap.utils.clamp(-5, 5, (event.clientY - bounds.top - bounds.height / 2) * .1));
          }, { signal: localListeners.signal });
          const reset = () => { bounds = null; xTo(0); yTo(0); };
          button.addEventListener("pointerleave", reset, { signal: localListeners.signal });
          button.addEventListener("blur", reset, { signal: localListeners.signal });
        });
      }
      return () => {
        localListeners.abort();
        restorers.reverse().forEach((restore) => restore());
      };
    });
    document.addEventListener("gbm:layoutchange", refresh, { signal: listeners.signal });
    document.querySelectorAll("details").forEach((details) => { details.addEventListener("toggle", refresh, { signal: listeners.signal }); });
    document.querySelectorAll("img").forEach((image) => {
      if (!image.complete) image.addEventListener("load", refresh, { once: true, signal: listeners.signal });
    });
    document.fonts?.ready.then(refresh);
    refresh();
  } catch {
    // Revert a partial setup so every section remains readable on failure.
    cleanup();
  }
  return cleanup;
}
