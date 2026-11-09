import { SITE_CONFIG } from "./site-config.js";

// The fictional businesses never receive bookings or messages. All quote
// links contact GBM Web using its shared, configurable commercial number.
const phone = String(SITE_CONFIG.whatsapp || "").replace(/\D/g, "");
const panels = [...document.querySelectorAll(".demo-panel")];
const tabs = [...document.querySelectorAll("[data-demo-tab]")];
const themeMeta = document.querySelector('meta[name="theme-color"]');
const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");

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

function animateHero(panel) {
  const gsap = window.gsap;
  if (!gsap || !motion.matches) return;
  gsap.from(panel.querySelectorAll(".hero-copy > *"), { autoAlpha: 0, y: 24, duration: .8, stagger: .1, ease: "power3.out", clearProps: "transform,opacity,visibility" });
  gsap.from(panel.querySelector(".hero-art"), { autoAlpha: 0, y: 28, rotation: 2, duration: 1, ease: "power3.out", clearProps: "transform,opacity,visibility" });
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
    animateHero(panel);
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

const filters = [...document.querySelectorAll("[data-menu-filter]")];
const dishes = [...document.querySelectorAll("[data-menu-category]")];
const filterStatus = document.querySelector("[data-filter-status]");
filters.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.menuFilter;
    filters.forEach((filter) => filter.setAttribute("aria-pressed", String(filter === button)));
    dishes.forEach((dish) => {
      dish.hidden = category !== "all" && category !== dish.dataset.menuCategory;
    });
    if (filterStatus) {
      const count = dishes.filter((dish) => !dish.hidden).length;
      filterStatus.textContent = `${count} opções no cardápio de demonstração`;
    }
  });
});

// Content remains visible and usable without JavaScript or GSAP.
if (window.gsap && "IntersectionObserver" in window && motion.matches) {
  const gsap = window.gsap;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      gsap.from(entry.target, { autoAlpha: 0, y: 28, duration: .75, ease: "power3.out", clearProps: "transform,opacity,visibility" });
      observer.unobserve(entry.target);
    });
  }, { threshold: .12 });
  document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
  window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}
