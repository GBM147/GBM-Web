const registeredEngines = new WeakSet();

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
      if (reduceMotion) return;
      const localListeners = new AbortController();
      const hero = document.querySelector(".hero");
      if (!introduced && hero && hero.getBoundingClientRect().bottom > 0) {
        introduced = true;
        const intro = gsap.timeline({ defaults: { duration: 0.7, ease: "power3.out", clearProps: "transform,opacity,visibility" } });
        intro.addLabel("enter", 0);
        const kicker = hero.querySelector(".hero-kicker");
        const lines = hero.querySelectorAll(".hero-title .line-inner");
        const description = hero.querySelector(".hero-description");
        const actions = hero.querySelector(".hero-actions");
        const art = hero.querySelector(".hero-art");
        if (kicker) intro.from(kicker, { y: 16, opacity: 0, duration: 0.5 }, "enter");
        if (lines.length) intro.from(lines, { yPercent: 108, opacity: 0, stagger: 0.09, duration: 0.9, ease: "power4.out" }, "enter+=0.1");
        if (description) intro.from(description, { y: 20, opacity: 0 }, "enter+=0.42");
        if (actions) intro.from(actions, { y: 16, opacity: 0 }, "enter+=0.58");
        if (art) intro.from(art, { y: isDesktop ? 34 : 20, opacity: 0, duration: 1.05 }, "enter+=0.18");
      }
      // Opacity preserves keyboard access while the reveal is waiting for scroll.
      const reveals = new Map();
      let pointerFocus = false;
      document.querySelectorAll("[data-reveal]").forEach((element) => {
        if (element.closest(".hero") || element.parentElement?.closest("[data-reveal]")) return;
        const tween = gsap.from(element, {
          y: isDesktop ? 28 : 18,
          opacity: 0,
          duration: 0.8,
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
      const artInner = hero?.querySelector(".hero-art-inner");
      if (isDesktop && artInner) {
        gsap.to(artInner, {
          y: -36,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.65, invalidateOnRefresh: true }
        });
      }
      const marquee = document.querySelector(".marquee-track");
      if (marquee) {
        gsap.to(marquee, {
          xPercent: isDesktop ? -8 : -4,
          ease: "none",
          scrollTrigger: { trigger: marquee.parentElement, start: "top bottom", end: "bottom top", scrub: 0.6 }
        });
      }
      const line = document.querySelector(".process-line");
      if (line) {
        gsap.from(line, {
          scaleY: 0.08,
          transformOrigin: "center top",
          ease: "none",
          scrollTrigger: { trigger: line.parentElement, start: "top 78%", end: "bottom 55%", scrub: 0.45 }
        });
      }
      if (isDesktop && finePointer) {
        const loops = [];
        if (hero) {
          hero.querySelectorAll(".orbit-object").forEach((element, index) => {
            loops.push(gsap.to(element, {
              y: index % 2 ? 8 : -8,
              rotation: index % 2 ? -3 : 3,
              duration: 3.4 + index * 0.45,
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
      return () => { localListeners.abort(); };
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
