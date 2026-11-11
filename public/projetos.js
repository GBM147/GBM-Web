import { SITE_CONFIG } from "./site-config.js";

// The fictional businesses never receive bookings or messages. All quote
// links contact GBM Web using its shared, configurable commercial number.
const phone = String(SITE_CONFIG.whatsapp || "").replace(/\D/g, "");
const panels = [...document.querySelectorAll(".demo-panel")];
const tabs = [...document.querySelectorAll("[data-demo-tab]")];
const themeMeta = document.querySelector('meta[name="theme-color"]');
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
// Content stays visible and usable without JavaScript, GSAP or motion:
// every hidden starting state below is set by GSAP, never by the style sheets.
const animated = Boolean(gsap && ScrollTrigger) && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if (animated) gsap.registerPlugin(ScrollTrigger);

function setQuote(link, project) {
  if (!phone) return;
  const text = `Olá! Vi a demonstração ${project} no site da GBM Web e quero um site assim para minha empresa`;
  link.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

panels.forEach((panel) => {
  panel.querySelectorAll("[data-quote]").forEach((link) => setQuote(link, panel.dataset.project));
});

const CLEAR = "transform,opacity,visibility";
const all = (root, selector) => [...root.querySelectorAll(selector)];

// Fades a block up the first time it scrolls into view.
function reveal(elements, vars = {}) {
  elements.forEach((element) => {
    gsap.from(element, { autoAlpha: 0, y: 30, duration: .8, ease: "power3.out", clearProps: CLEAR, ...vars, scrollTrigger: { trigger: element, start: "top 88%", once: true } });
  });
}

// Entrance of the top of each demo, replayed whenever its tab opens.
const intros = {
  // Época: each headline line rises from behind a mask, like a clean cut.
  barbearia(panel) {
    gsap.from(all(panel, ".ep-ln > *"), { yPercent: 115, duration: 1, stagger: .09, ease: "expo.out", clearProps: "transform" });
    gsap.from(all(panel, ".ep-hero .ep-eyebrow, .ep-lead, .ep-actions, .ep-hero-note"), { autoAlpha: 0, y: 18, duration: .7, stagger: .07, delay: .35, ease: "power3.out", clearProps: CLEAR });
    gsap.from(panel.querySelector(".ep-arch"), { clipPath: "inset(100% 0% 0% 0%)", duration: 1.1, delay: .1, ease: "expo.out", clearProps: "clipPath" });
    gsap.from(panel.querySelector(".ep-seal"), { autoAlpha: 0, scale: .7, rotation: -50, duration: .9, delay: .55, ease: "back.out(1.6)", clearProps: CLEAR });
  },
  // Terra & Mesa: soft and slow, the plate arrives at the table.
  restaurante(panel) {
    gsap.from(all(panel, "[data-tm-in]"), { autoAlpha: 0, y: 26, filter: "blur(6px)", duration: .9, stagger: .09, ease: "power3.out", clearProps: `${CLEAR},filter` });
    gsap.from(panel.querySelector(".tm-plate-svg"), { autoAlpha: 0, yPercent: 16, duration: 1.3, delay: .25, ease: "expo.out", clearProps: CLEAR });
    gsap.from(all(panel, ".tm-float"), { autoAlpha: 0, scale: .6, duration: .8, stagger: .08, delay: .6, ease: "back.out(1.7)", clearProps: "opacity,visibility" });
    gsap.from(panel.querySelector(".tm-badge"), { autoAlpha: 0, scale: .7, duration: .7, delay: .9, ease: "back.out(1.8)", clearProps: CLEAR });
  },
  // Pata Club: everything bounces in, and paw prints walk across the hero.
  petshop(panel) {
    gsap.from(all(panel, "[data-pc-in]"), { autoAlpha: 0, y: 30, scale: .96, duration: .7, stagger: .08, ease: "back.out(1.5)", clearProps: CLEAR });
    gsap.from(panel.querySelector(".pc-hero-art"), { autoAlpha: 0, y: 40, scale: .92, duration: .9, delay: .2, ease: "back.out(1.4)", clearProps: CLEAR });
    gsap.fromTo(panel.querySelector(".pc-mark path"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .7, delay: .75, ease: "power2.out" });
    gsap.fromTo(all(panel, ".pc-paw"), { autoAlpha: 0, scale: .5 }, { autoAlpha: .22, scale: 1, duration: .35, stagger: .14, delay: .6, ease: "back.out(2)" });
  }
};

// Scroll-linked and pointer effects, created once per demo.
const scenes = {
  barbearia(panel) {
    reveal(all(panel, "[data-ep-reveal]"));
    all(panel, "[data-ep-row]").forEach((row) => {
      gsap.from(row.children, { autoAlpha: 0, y: 26, duration: .7, stagger: .05, ease: "power3.out", clearProps: CLEAR, scrollTrigger: { trigger: row, start: "top 90%", once: true } });
    });
    // The copper line fills as the three steps of the ritual scroll by.
    const steps = all(panel, "[data-ep-step]");
    gsap.fromTo(panel.querySelector(".ep-progress i"), { scaleX: 0 }, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: panel.querySelector(".ep-steps"),
        start: "top 88%",
        end: "bottom 62%",
        scrub: .4,
        onUpdate: (self) => steps.forEach((step, index) => step.classList.toggle("is-dim", self.progress < (index + .2) / steps.length))
      }
    });
  },
  restaurante(panel) {
    const hero = panel.querySelector(".tm-hero");
    const scroll = { trigger: hero, start: "top top+=56", end: "bottom top" };
    // The plate turns and the ingredients drift at different speeds while the hero scrolls.
    gsap.to(panel.querySelector(".tm-plate"), { rotation: 80, svgOrigin: "284 295", ease: "none", scrollTrigger: { ...scroll, scrub: .6 } });
    all(panel, ".tm-float").forEach((element, index) => {
      gsap.to(element, { yPercent: [-120, 90, -80, 130][index], ease: "none", scrollTrigger: { ...scroll, scrub: .8 } });
      gsap.to(element, { rotation: index % 2 ? -10 : 12, x: index % 2 ? 6 : -6, duration: 3.2 + index * .7, ease: "sine.inOut", repeat: -1, yoyo: true });
    });
    reveal(all(panel, "[data-tm-reveal]"));
    // The herb branch draws itself, then the leaves open.
    const branch = { trigger: panel.querySelector(".tm-branch"), start: "top 82%", once: true };
    gsap.fromTo(panel.querySelector(".tm-stem"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut", scrollTrigger: branch });
    gsap.from(panel.querySelector(".tm-leaves"), { autoAlpha: 0, scale: .9, transformOrigin: "50% 100%", duration: 1, delay: .6, ease: "power3.out", clearProps: CLEAR, scrollTrigger: branch });
    gsap.from(all(panel, "[data-tm-card]"), { autoAlpha: 0, y: 40, duration: .8, stagger: .08, ease: "power3.out", clearProps: CLEAR, scrollTrigger: { trigger: panel.querySelector(".tm-cards"), start: "top 86%", once: true } });
  },
  petshop(panel) {
    reveal(all(panel, "[data-pc-reveal]"), { ease: "back.out(1.3)" });
    all(panel, ".pc-bento, .pc-bubbles-row").forEach((group) => {
      gsap.from(all(group, "[data-pc-card]"), { autoAlpha: 0, y: 40, scale: .94, duration: .7, stagger: .08, ease: "back.out(1.6)", clearProps: CLEAR, scrollTrigger: { trigger: group, start: "top 86%", once: true } });
    });
    if (!finePointer) return;
    // The dog's eyes follow the pointer. Decorative, so it eases instead of snapping.
    const art = panel.querySelector(".pc-hero-art");
    const pupils = panel.querySelector(".pc-pupils");
    const lookX = gsap.quickTo(pupils, "x", { duration: .5, ease: "power3" });
    const lookY = gsap.quickTo(pupils, "y", { duration: .5, ease: "power3" });
    panel.querySelector(".pc-hero").addEventListener("pointermove", (event) => {
      const box = art.getBoundingClientRect();
      lookX(gsap.utils.clamp(-5, 5, ((event.clientX - box.left) / box.width - .52) * 12));
      lookY(gsap.utils.clamp(-4, 4, ((event.clientY - box.top) / box.height - .4) * 10));
    });
    // The membership card tilts toward the pointer.
    const card = panel.querySelector("[data-pc-tilt]");
    const zone = card.parentElement;
    gsap.set(card, { transformPerspective: 900 });
    const tiltX = gsap.quickTo(card, "rotationX", { duration: .6, ease: "power3" });
    const tiltY = gsap.quickTo(card, "rotationY", { duration: .6, ease: "power3" });
    zone.addEventListener("pointermove", (event) => {
      const box = zone.getBoundingClientRect();
      tiltY(((event.clientX - box.left) / box.width - .5) * 22);
      tiltX((.5 - (event.clientY - box.top) / box.height) * 16);
    });
    zone.addEventListener("pointerleave", () => { tiltX(0); tiltY(0); });
  }
};

const started = new Set();
function play(panel) {
  if (!animated) return;
  intros[panel.id]?.(panel);
  if (!started.has(panel.id)) {
    started.add(panel.id);
    scenes[panel.id]?.(panel);
  }
  // Panels change the page height, so scroll positions are measured again.
  ScrollTrigger.refresh();
}

let active = null;
function show(panel, { scrollTop = false } = {}) {
  if (!panel) return;
  if (panel !== active) {
    active = panel;
    panels.forEach((item) => { item.hidden = item !== panel; });
    tabs.forEach((tab) => {
      if (tab.dataset.demoTab === panel.id) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    });
    if (themeMeta && panel.dataset.themeColor) themeMeta.content = panel.dataset.themeColor;
    document.title = `${panel.dataset.project} · Projetos GBM Web`;
    document.querySelectorAll("[data-quote-active]").forEach((link) => setQuote(link, panel.dataset.project));
    play(panel);
  }
  if (scrollTop) window.scrollTo(0, 0);
}

// Accepts ?demo=barbearia (old links and redirects), #barbearia or a section id.
function panelFromLocation() {
  const param = new URLSearchParams(window.location.search).get("demo");
  if (param && panels.some((panel) => panel.id === param)) {
    window.history.replaceState(null, "", `${window.location.pathname}#${param}`);
  }
  const hash = decodeURIComponent(window.location.hash.slice(1));
  const target = hash ? document.getElementById(hash) : null;
  return { panel: target?.closest(".demo-panel") || panels[0], target };
}

const initial = panelFromLocation();
show(initial.panel, { scrollTop: initial.target === initial.panel });
window.addEventListener("hashchange", () => {
  const { panel, target } = panelFromLocation();
  show(panel, { scrollTop: target === panel });
  if (target && target !== panel) target.scrollIntoView();
});

// Menu filter of the restaurant demo: the pill slides, the dishes swap with a short fade.
const filterGroup = document.querySelector(".tm-filters");
const filters = [...document.querySelectorAll("[data-menu-filter]")];
const dishes = [...document.querySelectorAll("[data-menu-category]")];
const filterStatus = document.querySelector("[data-filter-status]");
let filterTimer;
filters.forEach((button, index) => {
  button.addEventListener("click", () => {
    const category = button.dataset.menuFilter;
    filters.forEach((filter) => filter.setAttribute("aria-pressed", String(filter === button)));
    if (filterGroup) filterGroup.dataset.active = String(index);
    const apply = () => {
      dishes.forEach((dish) => {
        dish.hidden = category !== "all" && category !== dish.dataset.menuCategory;
        dish.classList.remove("is-leaving");
      });
      const visible = dishes.filter((dish) => !dish.hidden);
      if (filterStatus) filterStatus.textContent = `${visible.length} opções no cardápio de demonstração`;
      if (!animated) return;
      gsap.from(visible, { autoAlpha: 0, y: 10, duration: .35, stagger: .04, ease: "power3.out", clearProps: CLEAR });
      ScrollTrigger.refresh();
    };
    window.clearTimeout(filterTimer);
    if (!animated) { apply(); return; }
    dishes.forEach((dish) => dish.classList.add("is-leaving"));
    filterTimer = window.setTimeout(apply, 200);
  });
});
