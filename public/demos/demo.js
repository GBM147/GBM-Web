import { SITE_CONFIG } from "../site-config.js";

// The fictional business never receives bookings or messages. All quote
// links contact GBM Web using its shared, configurable commercial number.
const phone = String(SITE_CONFIG.whatsapp || "").replace(/\D/g, "");
const project = document.body.dataset.project || "esta demonstração";
const quoteText = `Olá! Vi a demonstração ${project} no site da GBM Web e quero um site assim para minha empresa`;
document.querySelectorAll("[data-quote]").forEach((link) => {
  if (!phone) return;
  link.href = `https://wa.me/${phone}?text=${encodeURIComponent(quoteText)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
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
if (window.gsap) {
  const gsap = window.gsap;
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", (context) => {
    gsap.from(".hero-copy > *", {
      autoAlpha: 0,
      y: 24,
      duration: .8,
      stagger: .1,
      ease: "power3.out",
      clearProps: "transform,opacity,visibility"
    });
    gsap.from(".hero-art", {
      autoAlpha: 0,
      y: 28,
      rotation: 2,
      duration: 1,
      ease: "power3.out",
      clearProps: "transform,opacity,visibility"
    });
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        context.add(() => {
          gsap.from(entry.target, {
            autoAlpha: 0,
            y: 28,
            duration: .75,
            ease: "power3.out",
            clearProps: "transform,opacity,visibility"
          });
        });
        observer.unobserve(entry.target);
      });
    }, { threshold: .12 });
    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  });
  window.addEventListener("pagehide", () => media.revert(), { once: true });
}
