const registeredEngines = new WeakSet();

// Screens shown by the 3D phone: the three example sites and the WhatsApp chat (index 3).
const SCREENS = ["/assets/screens/barbearia.webp", "/assets/screens/restaurante.webp", "/assets/screens/petshop.webp", "/assets/screens/whatsapp.webp"];
const CHAT = 3;
const TAU = Math.PI * 2;
const PHONE_RATIO = 2.06; // height / width of the 3D phone body
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const headerHeight = () => document.querySelector(".site-header")?.offsetHeight || 0;

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

// Layout box without the element's own GSAP transform: the opening and the panel tweens move
// things for a moment, and the phone must aim at where they rest.
function layoutBox(element) {
  const moved = element.style.transform;
  element.style.transform = "none";
  const box = element.getBoundingClientRect();
  element.style.transform = moved;
  return box;
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


// A section pinned under the header while scrolling moves through its panels.
// windows: [enter, leave] progress for each panel (the first one starts visible).
function pinnedStory(gsap, ScrollTrigger, { section, panels, dots = [], windows, length, build, onStep }) {
  const stage = section.querySelector(".story-stage");
  section.classList.add("is-story");
  const timeline = gsap.timeline({ paused: true, defaults: { duration: 0.05 } });
  gsap.set(panels.slice(1), { autoAlpha: 0, y: 40 });
  panels.forEach((panel, index) => {
    const [enter, leave] = windows[index];
    if (index > 0) timeline.to(panel, { autoAlpha: 1, y: 0, ease: "power2.out" }, enter);
    if (leave < 1) timeline.to(panel, { autoAlpha: 0, y: -40, ease: "power2.in" }, leave);
  });
  build?.(timeline);
  timeline.set({}, {}, 1);
  let step = -1;
  timeline.eventCallback("onUpdate", () => {
    const progress = timeline.progress();
    let current = 0;
    windows.forEach(([enter], index) => { if (progress >= enter - 0.03) current = index; });
    if (current === step) return;
    step = current;
    panels.forEach((panel, index) => { panel.inert = index !== current; });
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === current));
    onStep?.(current);
  });
  panels.forEach((panel, index) => { panel.inert = index !== 0; });
  const trigger = ScrollTrigger.create({
    trigger: stage,
    start: () => `top top+=${headerHeight()}`,
    end: () => `+=${Math.round(window.innerHeight * length)}`,
    pin: true,
    scrub: 0.6,
    animation: timeline,
    anticipatePin: 1,
    invalidateOnRefresh: true
  });
  return {
    trigger,
    timeline,
    cleanup: () => {
      section.classList.remove("is-story");
      panels.forEach((panel) => { panel.inert = false; });
    }
  };
}

// Phone poses along the page. Each key is relative to an anchor (the empty visual column of
// a section): dx/dy move it in viewport fractions and k sets its height against the anchor.
// zoom: 1 brings it up close instead (closeUp in createChoreography).
const HERO_KEYS = [
  { p: 0, k: 0.82, rx: 0.1, ry: -0.42, rz: 0.06, screen: 0, chat: 0, scroll: 0 },
  { p: 0.13, k: 0.82, rx: 0.06, ry: -0.3, rz: 0.04, screen: 0, chat: 0, scroll: 0.2 },
  { p: 0.25, dy: 0.01, k: 0.84, rx: 0.05, ry: 0.3, rz: -0.03, screen: 0, chat: 0, scroll: 0 },
  // The three examples up close, a full turn between them: the site changes while it shows its back.
  { p: 0.32, zoom: 1, rx: 0.02, ry: -0.12, rz: 0, screen: 0, chat: 0, scroll: 0 },
  { p: 0.44, zoom: 1, rx: 0.03, ry: 0.1, rz: 0.01, screen: 0, chat: 0, scroll: 0.45 },
  { p: 0.51, zoom: 1, rx: 0.02, ry: TAU - 0.12, rz: 0, screen: 1, chat: 0, scroll: 0 },
  { p: 0.62, zoom: 1, rx: 0.03, ry: TAU + 0.1, rz: 0.01, screen: 1, chat: 0, scroll: 0.45 },
  { p: 0.69, zoom: 1, rx: 0.02, ry: TAU * 2 - 0.12, rz: 0, screen: 2, chat: 0, scroll: 0 },
  { p: 0.79, zoom: 1, rx: 0.03, ry: TAU * 2 + 0.1, rz: 0.01, screen: 2, chat: 0, scroll: 0.45 },
  // Back to its column for the WhatsApp step, turning once more as the chat comes in.
  { p: 0.88, k: 0.95, rx: 0, ry: TAU * 3, rz: 0, screen: 2, chat: 1, scroll: 0.45 },
  { p: 1, dy: 0.02, k: 0.97, rx: -0.02, ry: TAU * 3 + 0.08, rz: 0, screen: 2, chat: 1, scroll: 0.45 }
];
const PLANS_KEYS = [
  { p: 0, k: 0.8, rx: 0.08, ry: TAU * 4 - 0.35, rz: -0.04, screen: 0, chat: 0, scroll: 0 },
  { p: 0.22, k: 0.82, rx: 0.05, ry: TAU * 4 + 0.3, rz: -0.03, screen: 0, chat: 0, scroll: 0.2 },
  { p: 0.43, k: 0.82, rx: 0.06, ry: TAU * 4 + 0.1, rz: 0.02, screen: 0, chat: 0, scroll: 0.45 },
  { p: 0.53, k: 0.82, rx: 0.05, ry: TAU * 5 + 0.1, rz: 0.02, screen: 1, chat: 0, scroll: 0 },
  { p: 0.68, k: 0.82, rx: 0.06, ry: TAU * 5 - 0.2, rz: -0.02, screen: 1, chat: 0, scroll: 0.4 },
  { p: 0.78, k: 0.82, rx: 0.05, ry: TAU * 6 - 0.2, rz: 0.02, screen: 2, chat: 0, scroll: 0 },
  { p: 1, k: 0.84, rx: 0.04, ry: TAU * 6 + 0.25, rz: 0.03, screen: 2, chat: 0, scroll: 0.45 }
];
const CONTACT_KEYS = [
  { p: 0, k: 0.85, rx: 0.06, ry: TAU * 7 - 0.3, rz: 0.03, screen: 2, chat: 1, scroll: 0 },
  { p: 0.6, k: 0.92, rx: 0.02, ry: TAU * 7 + 0.1, rz: 0, screen: 2, chat: 1, scroll: 0 },
  { p: 1, k: 0.95, rx: 0, ry: TAU * 7 + 0.25, rz: -0.02, screen: 2, chat: 1, scroll: 0 }
];

// Turns the scroll position into the phone pose: chapters for each pinned scene and the
// passages between them, with positions measured from the layout.
function createChoreography({ hero, plans, contact, form, isDesktop }) {
  let chapters = [];
  const anchorOf = (element) => {
    const stage = element?.closest(".story-stage");
    if (!element || !stage) return null;
    const box = layoutBox(element);
    const frame = stage.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const top = headerHeight() + (box.top - frame.top);
    return {
      x: (box.left + box.width / 2) / window.innerWidth - 0.5,
      y: 0.5 - (top + box.height / 2) / window.innerHeight,
      h: box.height / window.innerHeight
    };
  };
  // Where the phone goes for the close-up of the examples. Large screens: big, centred under the
  // header and clear of the caption on the left. Phones: above the caption at the bottom.
  const closeUp = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = headerHeight();
    const caption = hero.section.querySelector(".project-panel");
    if (isDesktop) {
      const h = (0.82 * (vh - top)) / vh;
      const right = caption ? layoutBox(caption).right : vw * 0.4;
      const center = Math.max(vw / 2, right + 56 + (h * vh) / PHONE_RATIO / 2);
      return { x: center / vw - 0.5, y: 0.5 - (top + (vh - top) / 2) / vh, h };
    }
    // The stage can reach below the screen; --below keeps the caption above the bottom edge.
    const stage = hero.section.querySelector(".story-stage");
    const frame = stage.getBoundingClientRect();
    stage.style.setProperty("--below", `${Math.max(0, Math.round(frame.height - (vh - top)))}px`);
    const captionTop = caption ? top + layoutBox(caption).top - frame.top : vh * 0.78;
    const space = Math.max(vh * 0.3, captionTop - top - 30);
    return { x: 0, y: 0.5 - (top + 12 + space / 2) / vh, h: Math.min(0.64, space / vh) };
  };
  const resolve = (key, anchor, near = null) => {
    const base = { x: anchor.x + (key.dx || 0), y: anchor.y + (key.dy || 0), h: anchor.h * (key.k || 1) };
    const zoom = near ? key.zoom || 0 : 0;
    const blend = (name) => base[name] + ((near ? near[name] : base[name]) - base[name]) * zoom;
    return {
      p: key.p, x: blend("x"), y: blend("y"), h: blend("h"),
      rx: key.rx, ry: key.ry, rz: key.rz, screen: key.screen, chat: key.chat, scroll: key.scroll
    };
  };
  const away = (pose, extraTurn) => ({ ...pose, p: 1, y: pose.y + 1, h: pose.h * 0.6, ry: pose.ry + extraTurn, hidden: true });
  const rebuild = () => {
    const vh = window.innerHeight;
    const heroAnchor = anchorOf(hero.section.querySelector(".story-visual"));
    if (!heroAnchor) { chapters = []; return; }
    const near = closeUp();
    const heroPoses = HERO_KEYS.map((key) => resolve(key, heroAnchor, near));
    const heroEnd = { ...heroPoses[heroPoses.length - 1] };
    const list = [{ start: hero.trigger.start, end: hero.trigger.end, keys: heroPoses, hero: true }];
    const plansAnchor = isDesktop && plans ? anchorOf(plans.section.querySelector(".story-visual")) : null;
    const contactAnchor = isDesktop && contact ? anchorOf(contact.section.querySelector(".story-visual")) : null;
    if (plansAnchor && contactAnchor) {
      const plansPoses = PLANS_KEYS.map((key) => resolve(key, plansAnchor));
      const contactPoses = CONTACT_KEYS.map((key) => resolve(key, contactAnchor));
      const plansEnd = plansPoses[plansPoses.length - 1];
      const contactEnd = contactPoses[contactPoses.length - 1];
      list.push(
        { start: hero.trigger.end, end: Math.max(hero.trigger.end + 1, plans.trigger.start), keys: [{ ...heroEnd, p: 0 }, { ...plansPoses[0], p: 1 }] },
        { start: plans.trigger.start, end: plans.trigger.end, keys: plansPoses },
        // The phone waits on the left while the last plan scrolls away, then crosses to the contact side.
        { start: plans.trigger.end, end: Math.max(plans.trigger.end + 1, contact.trigger.start), keys: [{ ...plansEnd, p: 0 }, { ...plansEnd, p: 0.55, ry: plansEnd.ry + Math.PI, y: plansEnd.y + 0.04, chat: 1 }, { ...contactPoses[0], p: 1 }] },
        { start: contact.trigger.start, end: contact.trigger.end, keys: contactPoses }
      );
      // Then it stands beside the form while the form goes by, and leaves.
      const beside = form?.visual ? layoutBox(form.visual) : null;
      if (beside?.width) {
        const top = headerHeight();
        const room = vh - top;
        const box = layoutBox(form.element);
        const formTop = box.top + window.scrollY;
        const pose = {
          x: (beside.left + beside.width / 2) / window.innerWidth - 0.5,
          y: 0.5 - (top + room / 2) / vh,
          h: (0.62 * room) / vh,
          rx: 0.04, ry: contactEnd.ry + TAU - 0.35, rz: 0.02, screen: 2, chat: 1, scroll: 0
        };
        const settled = { ...pose, ry: pose.ry + 0.2 };
        const arrive = Math.max(contact.trigger.end + vh * 0.2, formTop - top - 40 - Math.max(0, (room - box.height) / 2));
        const leave = arrive + Math.max(vh * 0.3, box.height - room + 80);
        list.push(
          { start: contact.trigger.end, end: arrive, keys: [{ ...contactEnd, p: 0 }, { ...pose, p: 1 }] },
          { start: arrive, end: leave, keys: [{ ...pose, p: 0 }, { ...settled, p: 1 }] },
          { start: leave, end: leave + vh * 0.8, keys: [{ ...settled, p: 0 }, away(settled, 0.8)] }
        );
      } else {
        list.push({ start: contact.trigger.end, end: contact.trigger.end + vh * 0.8, keys: [{ ...contactEnd, p: 0 }, away(contactEnd, 0.8)] });
      }
    } else {
      // Narrow screens: after the hero the phone leaves, giving the plans and the form the whole screen.
      list.push({ start: hero.trigger.end, end: hero.trigger.end + vh * 0.6, keys: [{ ...heroEnd, p: 0 }, away(heroEnd, 0.6)] });
    }
    chapters = list;
  };
  const poseAt = (scroll) => {
    if (!chapters.length) return null;
    let chapter = chapters[0];
    let progress = 0;
    if (scroll >= chapters[0].start) {
      chapter = chapters.find((item) => scroll < item.end) || chapters[chapters.length - 1];
      progress = Math.min(1, Math.max(0, (scroll - chapter.start) / (chapter.end - chapter.start || 1)));
    }
    const keys = chapter.keys;
    let index = 0;
    while (index < keys.length - 2 && progress > keys[index + 1].p) index++;
    const a = keys[index];
    const b = keys[index + 1];
    const t = Math.min(1, Math.max(0, (progress - a.p) / (b.p - a.p || 1)));
    const e = ease(t);
    const mix = (name) => a[name] + (b[name] - a[name]) * e;
    return {
      x: mix("x"), y: mix("y"), h: mix("h"), rx: mix("rx"), ry: mix("ry"), rz: mix("rz"),
      chat: mix("chat"), scroll: mix("scroll"),
      // The site on the screen changes while the phone shows its back.
      screen: t < 0.5 ? a.screen : b.screen,
      hidden: Boolean(b.hidden && t >= 1),
      hero: chapter.hero ? progress : null
    };
  };
  return { rebuild, poseAt };
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
      const root = document.documentElement;
      if (reduceMotion) {
        root.classList.remove("intro");
        return () => {};
      }
      const restorers = [];
      const local = new AbortController();
      const signal = local.signal;
      if (isDesktop && finePointer) {
        restorers.push(initLenis(gsap, ScrollTrigger));
        restorers.push(initCursor(gsap, signal));
      }

      // 1. Hero: opening, phone-first, the three examples up close (one per step), then the WhatsApp chat.
      const heroSection = document.querySelector(".hero");
      const pricing = document.querySelector(".pricing-section");
      const contactSection = document.querySelector(".contact-section");
      const poster = heroSection?.querySelector(".poster-phone img");
      let scene = null;
      let hero = null;
      if (heroSection?.querySelector(".story-stage")) {
        const word = heroSection.querySelector(".story-word");
        const glow = heroSection.querySelector(".story-glow");
        hero = pinnedStory(gsap, ScrollTrigger, {
          section: heroSection,
          panels: [...heroSection.querySelectorAll(".story-panel")],
          dots: [...heroSection.querySelectorAll(".story-dots li")],
          windows: [[0, 0.12], [0.16, 0.27], [0.32, 0.44], [0.51, 0.62], [0.69, 0.79], [0.86, 1]],
          length: isDesktop ? 4.4 : 4,
          build: (timeline) => timeline
            .fromTo(word, { scale: 1 }, { scale: 1.35, ease: "none", duration: 1 }, 0)
            .fromTo(word, { opacity: 0.95 }, { opacity: 0.12, ease: "none", duration: 0.3 }, 0)
            .fromTo(glow, { scale: 0.85, opacity: 0.7 }, { scale: 1.3, opacity: 1, ease: "none", duration: 1 }, 0),
          // Without the 3D phone the still image follows the steps.
          onStep: (step) => { if (!scene && poster) poster.src = SCREENS[[0, 0, 0, 1, 2, CHAT][step]]; }
        });
        restorers.push(hero.cleanup, () => { if (poster) poster.src = SCREENS[0]; });
      }

      // 2. Plans: an opening and one plan per step; the price counts up as it arrives.
      let plans = null;
      if (pricing?.querySelector(".story-stage")) {
        const panels = [...pricing.querySelectorAll(".story-panel")];
        const windows = [[0, 0.18], [0.24, 0.43], [0.49, 0.68], [0.74, 1]];
        plans = pinnedStory(gsap, ScrollTrigger, {
          section: pricing,
          panels,
          dots: [...pricing.querySelectorAll(".story-dots li")],
          windows,
          length: isDesktop ? 3.2 : 3,
          build: (timeline) => {
            timeline.fromTo(pricing.querySelector(".story-word"), { scale: 0.9, opacity: 0.9 }, { scale: 1.25, opacity: 0.18, ease: "none", duration: 1 }, 0);
            panels.slice(1).forEach((panel, index) => {
              const [enter] = windows[index + 1];
              const amount = panel.querySelector(".plan-price strong");
              const target = Number(amount?.dataset.value || 0);
              const counter = { value: 0 };
              if (amount && target) {
                timeline.fromTo(counter, { value: 0 }, {
                  value: target, duration: 0.07, ease: "power2.out",
                  onUpdate: () => { amount.textContent = String(Math.round(counter.value)); }
                }, enter);
              }
              timeline.from(panel.querySelectorAll(".price-features li"), { x: 30, autoAlpha: 0, stagger: 0.012, duration: 0.04, ease: "power2.out" }, enter + 0.04);
            });
          }
        });
        restorers.push(plans.cleanup, () => {
          pricing.querySelectorAll(".plan-price strong").forEach((amount) => { amount.textContent = amount.dataset.value; });
        });
      }

      // 3. Contact: the title rises word by word while the section comes up, then the scene pins
      // and shows how it works; the form follows, each part rising as it comes into view.
      let contact = null;
      const contactStage = contactSection?.querySelector(".story-stage");
      const contactTitle = contactSection?.querySelector(".contact-intro h2");
      if (contactStage && contactTitle) {
        const split = splitWords(contactTitle);
        restorers.push(split.restore);
        const how = contactSection.querySelector(".contact-how");
        contact = pinnedStory(gsap, ScrollTrigger, {
          section: contactSection,
          panels: [...contactStage.querySelectorAll(".story-panel")],
          dots: [...contactStage.querySelectorAll(".story-dots li")],
          windows: [[0, 0.42], [0.5, 1]],
          length: isDesktop ? 2.2 : 1.9,
          build: (timeline) => {
            timeline.fromTo(contactSection.querySelector(".story-word"), { scale: 0.85, opacity: 0.25 }, { scale: 1.15, opacity: 0.9, ease: "none", duration: 1 }, 0);
            if (!how) return;
            timeline.from(how.querySelectorAll(".contact-steps li"), { x: 30, opacity: 0, stagger: 0.04, duration: 0.06, ease: "power2.out" }, 0.56);
            timeline.from(how.querySelectorAll(":scope > .button, :scope > .contact-details"), { y: 24, opacity: 0, stagger: 0.04, duration: 0.06, ease: "power2.out" }, 0.74);
          }
        });
        restorers.push(contact.cleanup);
        gsap.timeline({ scrollTrigger: { trigger: contactStage, start: "top 85%", end: () => `top top+=${headerHeight()}`, scrub: 0.6 } })
          .from(contactSection.querySelector(".contact-intro .eyebrow"), { y: 30, opacity: 0, duration: 0.3, ease: "power2.out" }, 0)
          .from(split.words, { yPercent: 110, opacity: 0, stagger: 0.08, duration: 0.45, ease: "power3.out" }, 0.1)
          .from(contactTitle.querySelector(":scope > svg"), { scale: 0, rotation: -90, opacity: 0, duration: 0.3, ease: "back.out(2)" }, 0.8);
      }
      // Opacity only, so keyboard users can still reach every field before it is in view.
      const contactForm = contactSection?.querySelector(".contact-form");
      contactForm?.querySelectorAll(":scope > .form-heading, :scope > label, :scope > .form-row, :scope > .form-submit, :scope > .form-note").forEach((part) => {
        gsap.from(part, { y: 46, opacity: 0, ease: "power2.out", scrollTrigger: { trigger: part, start: "top 97%", end: "top 74%", scrub: 0.6 } });
      });
      if (hero) hero.section = heroSection;
      if (plans) plans.section = pricing;
      if (contact) contact.section = contactSection;

      // 4. The 3D phone: one scene behind the whole page, loaded after the page is ready.
      const canvas = document.querySelector(".scene-canvas");
      const glow = document.querySelector(".scene-glow");
      const intro3d = { lift: introduced ? 0 : 1 };
      if (hero && canvas) {
        const form = contactForm ? { element: contactForm, visual: contactSection.querySelector(".form-visual") } : null;
        const choreography = createChoreography({ hero, plans, contact, form, isDesktop });
        ScrollTrigger.addEventListener("refresh", choreography.rebuild);
        restorers.push(() => ScrollTrigger.removeEventListener("refresh", choreography.rebuild));
        choreography.rebuild();
        let hidden = false;
        let first = true;
        const playback = () => {
          if (!scene) return;
          if (!hidden && !document.hidden) scene.start();
          else scene.stop();
        };
        const tick = () => {
          if (!scene) return;
          const pose = choreography.poseAt(window.scrollY);
          if (!pose) return;
          const lift = intro3d.lift;
          scene.setTarget({ x: pose.x, y: pose.y - lift * 0.45, h: pose.h * (1 - lift * 0.2), rx: pose.rx, ry: pose.ry - lift * 0.8, rz: pose.rz });
          scene.setScreen(pose.screen, CHAT, pose.chat, pose.scroll);
          if (first) { first = false; scene.jump(); }
          const shown = scene.current();
          const height = shown.h * window.innerHeight;
          glow?.style.setProperty("transform", `translate3d(${(0.5 + shown.x) * window.innerWidth}px, ${(0.5 - shown.y) * window.innerHeight}px, 0)`);
          glow?.style.setProperty("--glow-floor", `${Math.round(height * 0.5)}px`);
          glow?.style.setProperty("--glow-width", `${Math.round(height * 0.95)}px`);
          if (pose.hidden !== hidden) {
            hidden = pose.hidden;
            root.classList.toggle("scene-off", hidden);
            playback();
          }
        };
        gsap.ticker.add(tick);
        restorers.push(() => gsap.ticker.remove(tick));
        document.addEventListener("visibilitychange", playback, { signal });
        if (finePointer) {
          window.addEventListener("pointermove", (event) => {
            if (event.pointerType === "mouse") scene?.pointer(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
          }, { signal });
        }
        let cancelled = false;
        const load = () => {
          if (cancelled) return;
          import("/vendor/hero3d.js").then(({ createPhoneScene }) => {
            if (cancelled) return;
            scene = createPhoneScene(canvas, { screens: SCREENS, onReady: () => { if (!cancelled) root.classList.add("has-3d"); } });
            first = true;
            playback();
          }).catch(() => {});
        };
        if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 1500 });
        else window.setTimeout(load, 300);
        restorers.push(() => {
          cancelled = true;
          scene?.dispose();
          scene = null;
          root.classList.remove("has-3d", "scene-off");
        });
      }

      // Hero intro, after the opening on the first visit.
      if (!introduced && heroSection && heroSection.getBoundingClientRect().bottom > 0) {
        introduced = true;
        const title = splitChars(heroSection.querySelectorAll(".hero-title .line-inner"));
        restorers.push(title.restore);
        const intro = gsap.timeline({ paused: true, defaults: { duration: 0.7, ease: "power3.out", clearProps: "transform,opacity,visibility" } });
        intro.addLabel("enter", 0);
        const kicker = heroSection.querySelector(".hero-kicker");
        const spark = heroSection.querySelector(".title-spark");
        const description = heroSection.querySelector(".hero-description");
        const actions = heroSection.querySelector(".hero-actions");
        const note = heroSection.querySelector(".hero-note");
        const visual = heroSection.querySelector(".story-visual");
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
        if (visual) intro.from(visual, { y: 90, scale: 0.92, opacity: 0, duration: 1.25, ease: "power4.out" }, "enter+=.2");
        intro.to(intro3d, { lift: 0, duration: 1.4, ease: "power4.out", clearProps: "" }, "enter+=.2");

        const loader = document.querySelector(".intro-loader");
        if (root.classList.contains("intro") && loader) {
          const count = loader.querySelector(".intro-count");
          const counter = { value: 0 };
          const opening = gsap.timeline({
            onComplete: () => {
              root.classList.remove("intro");
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
          restorers.push(() => { opening.kill(); root.classList.remove("intro"); });
        } else {
          intro.play();
        }
      } else {
        intro3d.lift = 0;
        root.classList.remove("intro");
      }

      // Opacity preserves keyboard access while the reveal is waiting for scroll.
      const reveals = new Map();
      let pointerFocus = false;
      document.querySelectorAll("[data-reveal]").forEach((element) => {
        if (element.closest(".is-story")) return;
        const tween = gsap.from(element, {
          y: isDesktop ? 28 : 18, opacity: 0, duration: 0.8, ease: "power3.out", clearProps: "transform,opacity",
          scrollTrigger: { trigger: element, start: "top 91%", once: true }
        });
        reveals.set(element, tween);
      });
      document.addEventListener("focusin", (event) => {
        // Finishing a transform between pointerdown and click moves the hit target.
        if (pointerFocus) return;
        reveals.forEach((tween, element) => { if (element.contains(event.target)) tween.progress(1); });
      }, { signal });
      document.addEventListener("pointerdown", () => { pointerFocus = true; }, { capture: true, signal });
      document.addEventListener("keydown", () => { pointerFocus = false; }, { capture: true, signal });

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
          button.addEventListener("pointerenter", () => { bounds = button.getBoundingClientRect(); }, { signal });
          button.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse" || !bounds) return;
            xTo(gsap.utils.clamp(-8, 8, (event.clientX - bounds.left - bounds.width / 2) * 0.08));
            yTo(gsap.utils.clamp(-5, 5, (event.clientY - bounds.top - bounds.height / 2) * 0.1));
          }, { signal });
          const reset = () => { bounds = null; xTo(0); yTo(0); };
          button.addEventListener("pointerleave", reset, { signal });
          button.addEventListener("blur", reset, { signal });
        });
      }
      return () => {
        local.abort();
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
