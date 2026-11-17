const registeredEngines = new WeakSet();

// Screens shown by the 3D phone, in story order (steps 1–3 use 0–2, step 4 the chat).
const SCREENS = ["/assets/screens/barbearia.webp", "/assets/screens/restaurante.webp", "/assets/screens/petshop.webp", "/assets/screens/whatsapp.webp"];
const STORY_SCREENS = 2.6;

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

// Smooth scrolling on desktop, driven by the GSAP ticker so ScrollTrigger stays in sync.
function initLenis(gsap, ScrollTrigger) {
  const Lenis = window.Lenis;
  if (!Lenis) return () => {};
  const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -96 }, autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
  };
}

// A ring that follows the mouse and grows over anything clickable. The normal cursor stays visible.
function initCursor(gsap, signal) {
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.setAttribute("aria-hidden", "true");
  document.body.append(ring);
  gsap.set(ring, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
  const toX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
  const toY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    gsap.to(ring, { autoAlpha: 1, duration: 0.2, overwrite: "auto" });
    toX(event.clientX);
    toY(event.clientY);
  }, { signal });
  document.addEventListener("pointerover", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a, button, select, input, textarea, label, summary") : null;
    ring.classList.toggle("is-active", Boolean(target));
  }, { signal });
  document.documentElement.addEventListener("pointerleave", () => { gsap.to(ring, { autoAlpha: 0, duration: 0.2 }); }, { signal });
  return () => ring.remove();
}

// The header turns dark while it sits over the dark hero.
function initHeaderTone(ScrollTrigger) {
  const header = document.querySelector(".site-header");
  const band = document.querySelector(".hero .marquee-band");
  if (!header || !band) return () => {};
  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    endTrigger: band,
    end: () => `top top+=${header.offsetHeight}`,
    onToggle: (self) => header.classList.toggle("on-dark", self.isActive)
  });
  header.classList.add("on-dark");
  return () => header.classList.remove("on-dark");
}

// Pinned hero: scrolling moves through four steps, turning the 3D phone and swapping the copy.
function initStory(gsap, ScrollTrigger, { hero, isDesktop, finePointer, signal }) {
  const stage = hero.querySelector(".story-stage");
  const panels = [...hero.querySelectorAll(".story-panel")];
  const visual = hero.querySelector(".story-visual");
  const canvas = hero.querySelector(".story-canvas");
  const poster = hero.querySelector(".poster-phone img");
  const word = hero.querySelector(".story-word");
  const glow = hero.querySelector(".story-glow");
  const dots = [...hero.querySelectorAll(".story-dots li")];
  const swatches = [...hero.querySelectorAll("[data-screen]")];
  const header = document.querySelector(".site-header");
  if (!stage || panels.length !== 4 || !visual || !canvas) return () => {};
  hero.classList.add("is-story");
  let scene = null;
  let disposed = false;
  let step = -1;
  let inView = true;

  const pressSwatch = (index) => swatches.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.screen) === index)));
  const show = (index) => {
    if (scene) scene.showScreen(index);
    else if (poster) poster.src = SCREENS[index ?? step];
  };
  gsap.set(panels.slice(1), { autoAlpha: 0, y: 40 });
  const story = gsap.timeline({ paused: true, defaults: { duration: 0.05 } });
  story
    .to(panels[0], { autoAlpha: 0, y: -40, ease: "power2.in" }, 0.2)
    .to(panels[1], { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.27)
    .to(panels[1], { autoAlpha: 0, y: -40, ease: "power2.in" }, 0.46)
    .to(panels[2], { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.52)
    .to(panels[2], { autoAlpha: 0, y: -40, ease: "power2.in" }, 0.71)
    .to(panels[3], { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.77)
    .fromTo(word, { scale: 1, opacity: 0.95 }, { scale: 1.35, opacity: 0.2, ease: "none", duration: 1 }, 0)
    .fromTo(glow, { scale: 0.85, opacity: 0.7 }, { scale: 1.3, opacity: 1, ease: "none", duration: 1 }, 0);
  story.eventCallback("onUpdate", () => {
    const progress = story.progress();
    scene?.setProgress(progress);
    const current = progress < 0.25 ? 0 : progress < 0.5 ? 1 : progress < 0.75 ? 2 : 3;
    if (current === step) return;
    step = current;
    panels.forEach((panel, index) => { panel.inert = index !== current; });
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === current));
    // Leaving the styles step gives the screen back to the story.
    pressSwatch(2);
    show(null);
  });
  panels.forEach((panel, index) => { panel.inert = index !== 0; });

  ScrollTrigger.create({
    trigger: stage,
    start: () => `top top+=${header?.offsetHeight || 0}`,
    end: () => `+=${Math.round(window.innerHeight * (isDesktop ? STORY_SCREENS : STORY_SCREENS - 0.4))}`,
    pin: true,
    scrub: 0.6,
    animation: story,
    anticipatePin: 1,
    invalidateOnRefresh: true
  });

  swatches.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.screen);
      pressSwatch(index);
      if (scene) scene.showScreen(index);
      else if (poster) poster.src = SCREENS[index];
    }, { signal });
  });

  const updatePlayback = () => {
    if (!scene) return;
    if (inView && !document.hidden) scene.start();
    else scene.stop();
  };
  ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top", onToggle: (self) => { inView = self.isActive; updatePlayback(); } });
  document.addEventListener("visibilitychange", updatePlayback, { signal });
  if (finePointer) {
    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || !scene) return;
      const bounds = hero.getBoundingClientRect();
      scene.pointer((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5);
    }, { signal });
  }

  // The 3D phone loads after the page is ready; until then the still phone image is shown.
  const load = () => {
    if (disposed) return;
    import("/vendor/hero3d.js").then(({ createPhoneScene }) => {
      if (disposed) return;
      scene = createPhoneScene(canvas, {
        screens: SCREENS,
        centered: true,
        onReady: () => { if (!disposed) visual.classList.add("is-3d"); }
      });
      scene.setProgress(story.progress());
      updatePlayback();
    }).catch(() => {});
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 1500 });
  else window.setTimeout(load, 300);

  return {
    visual,
    cleanup: () => {
      disposed = true;
      scene?.dispose();
      scene = null;
      visual.classList.remove("is-3d");
      hero.classList.remove("is-story");
      panels.forEach((panel) => { panel.inert = false; });
      if (poster) poster.src = SCREENS[0];
    }
  };
}

export function initAnimations({ skipIntro = false } = {}) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) {
    document.documentElement.classList.remove("intro");
    return () => {};
  }
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
      const restorers = [];
      if (reduceMotion) {
        document.documentElement.classList.remove("intro");
        restorers.push(initHeaderTone(ScrollTrigger));
        return () => { restorers.forEach((restore) => restore()); };
      }
      const localListeners = new AbortController();
      if (isDesktop && finePointer) {
        restorers.push(initLenis(gsap, ScrollTrigger));
        restorers.push(initCursor(gsap, localListeners.signal));
      }
      const story = hero ? initStory(gsap, ScrollTrigger, { hero, isDesktop, finePointer, signal: localListeners.signal }) : null;
      if (story?.cleanup) restorers.push(story.cleanup);
      // Created after the pin so its end accounts for the pinned distance.
      restorers.push(initHeaderTone(ScrollTrigger));

      // Hero intro, after the opening on the first visit.
      if (!introduced && hero && hero.getBoundingClientRect().bottom > 0) {
        introduced = true;
        const title = splitChars(hero.querySelectorAll(".hero-title .line-inner"));
        restorers.push(title.restore);
        const intro = gsap.timeline({ paused: true, defaults: { duration: 0.7, ease: "power3.out", clearProps: "transform,opacity,visibility" } });
        intro.addLabel("enter", 0);
        const kicker = hero.querySelector(".hero-kicker");
        const spark = hero.querySelector(".title-spark");
        const description = hero.querySelector(".hero-description");
        const actions = hero.querySelector(".hero-actions");
        const note = hero.querySelector(".hero-note");
        if (kicker) intro.from(kicker, { y: 16, opacity: 0, duration: 0.5 }, "enter");
        if (title.chars.length) {
          intro.from(title.chars, {
            yPercent: 55, rotationX: -95, opacity: 0, transformOrigin: "50% 100%", transformPerspective: 500,
            stagger: 0.024, duration: 0.85, ease: "power4.out"
          }, "enter+=.1");
        }
        if (spark) intro.from(spark, { scale: 0, rotation: -200, opacity: 0, duration: 0.9, ease: "back.out(2.2)" }, "enter+=.75");
        if (description) intro.from(description, { y: 20, opacity: 0 }, "enter+=.55");
        if (actions) intro.from(actions, { y: 16, opacity: 0 }, "enter+=.7");
        if (note) intro.from(note, { y: 12, opacity: 0 }, "enter+=.8");
        const visual = hero.querySelector(".story-visual");
        if (visual) intro.from(visual, { y: 90, scale: 0.92, opacity: 0, duration: 1.25, ease: "power4.out" }, "enter+=.2");

        const loader = document.querySelector(".intro-loader");
        if (document.documentElement.classList.contains("intro") && loader) {
          const count = loader.querySelector(".intro-count");
          const counter = { value: 0 };
          const opening = gsap.timeline({
            onComplete: () => {
              document.documentElement.classList.remove("intro");
              try { sessionStorage.setItem("gbm-intro", "1"); } catch {}
              gsap.set(loader, { clearProps: "all" });
              intro.play();
              refresh();
            }
          });
          opening
            .to(loader.querySelectorAll(".intro-mark path"), { strokeDashoffset: 0, duration: 0.75, stagger: 0.12, ease: "power2.inOut" }, 0)
            .to(counter, { value: 100, duration: 0.9, ease: "power2.inOut", onUpdate: () => { if (count) count.textContent = String(Math.round(counter.value)); } }, 0)
            .to(loader, { yPercent: -100, duration: 0.55, ease: "power4.inOut" }, 1);
          restorers.push(() => {
            opening.kill();
            document.documentElement.classList.remove("intro");
          });
        } else {
          intro.play();
        }
      } else {
        document.documentElement.classList.remove("intro");
      }

      // Opacity preserves keyboard access while the reveal is waiting for scroll.
      const reveals = new Map();
      let pointerFocus = false;
      document.querySelectorAll("[data-reveal]").forEach((element) => {
        if (element.closest(".hero") || element.parentElement?.closest("[data-reveal]")) return;
        const card = element.matches(".price-card");
        const index = card ? [...element.parentElement.children].indexOf(element) : 0;
        const tween = gsap.from(element, {
          y: card ? 80 : isDesktop ? 28 : 18,
          opacity: 0,
          rotationX: card ? 16 : 0,
          transformPerspective: card ? 900 : 0,
          transformOrigin: "50% 100%",
          duration: card ? 1 : 0.8,
          delay: card ? index * 0.12 : 0,
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

      // Headings rise word by word; the contact heading also lights up as it scrolls by.
      document.querySelectorAll(".section-heading h2, .contact-copy h2").forEach((heading) => {
        const split = splitWords(heading);
        restorers.push(split.restore);
        gsap.from(split.words, {
          yPercent: 115, rotation: 3, duration: 0.95, ease: "power4.out", stagger: 0.06,
          scrollTrigger: { trigger: heading, start: "top 88%", once: true }
        });
        if (heading.closest(".contact-copy")) {
          gsap.fromTo(split.words, { opacity: 0.22 }, {
            opacity: 1, ease: "none", stagger: 0.1,
            scrollTrigger: { trigger: heading, start: "top 85%", end: "top 35%", scrub: true }
          });
        }
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
      gsap.to(progress, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

      // Segment band: runs on its own and speeds up and leans with the scroll.
      const track = document.querySelector(".marquee-track");
      if (track) {
        const loop = gsap.to(track, { xPercent: -50, duration: isDesktop ? 32 : 22, ease: "none", repeat: -1 });
        const skewTo = gsap.quickTo(track, "skewX", { duration: 0.5, ease: "power3" });
        const settle = () => { gsap.to(loop, { timeScale: 1, duration: 0.8, overwrite: true }); skewTo(0); };
        ScrollTrigger.create({
          trigger: track.parentElement, start: "top bottom", end: "bottom top",
          onToggle: (self) => { if (self.isActive) loop.resume(); else loop.pause(); },
          onUpdate: (self) => {
            const velocity = self.getVelocity();
            gsap.to(loop, { timeScale: gsap.utils.clamp(1, 5, 1 + Math.abs(velocity) / 350), duration: 0.25, overwrite: true });
            skewTo(gsap.utils.clamp(-9, 9, velocity / -260));
          }
        });
        ScrollTrigger.addEventListener("scrollEnd", settle);
        restorers.push(() => ScrollTrigger.removeEventListener("scrollEnd", settle));
      }

      if (isDesktop && finePointer) {
        document.querySelectorAll("[data-magnetic]").forEach((button) => {
          const xTo = gsap.quickTo(button, "x", { duration: 0.35, ease: "power3.out" });
          const yTo = gsap.quickTo(button, "y", { duration: 0.35, ease: "power3.out" });
          let bounds = null;
          button.addEventListener("pointerenter", () => { bounds = button.getBoundingClientRect(); }, { signal: localListeners.signal });
          button.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse" || !bounds) return;
            xTo(gsap.utils.clamp(-8, 8, (event.clientX - bounds.left - bounds.width / 2) * 0.08));
            yTo(gsap.utils.clamp(-5, 5, (event.clientY - bounds.top - bounds.height / 2) * 0.1));
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
    document.documentElement.classList.remove("intro");
    cleanup();
  }
  return cleanup;
}
