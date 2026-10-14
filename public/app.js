import { SITE_CONFIG } from "./site-config.js";
import { initAnimations } from "./animations.js";

const query = (selector) => document.querySelector(selector);
const queryAll = (selector) => [...document.querySelectorAll(selector)];
const notifyLayoutChange = () => document.dispatchEvent(new Event("gbm:layoutchange"));

function applySiteConfig() {
  for (const [selector, value] of [
    ["[data-brand]", SITE_CONFIG.brand],
    ["[data-descriptor]", SITE_CONFIG.descriptor],
    ["[data-location]", SITE_CONFIG.location]
  ]) {
    if (typeof value === "string") queryAll(selector).forEach((element) => { element.textContent = value; });
  }
  const number = String(SITE_CONFIG.whatsapp || "").replace(/\D/g, "");
  const message = SITE_CONFIG.whatsappMessage || "Olá! Quero conversar sobre um site para minha empresa";
  const validNumber = /^\d{10,15}$/.test(number);
  queryAll("a[data-whatsapp]").forEach((link) => {
    link.href = validNumber ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : "#contato";
    if (validNumber) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.removeAttribute("target");
      link.removeAttribute("rel");
    }
  });
  queryAll("[data-year]").forEach((element) => { element.textContent = String(new Date().getFullYear()); });
}

function createNode(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (typeof text === "string") node.textContent = text;
  return node;
}

function renderPlans() {
  const grid = query("#pricingGrid");
  if (!grid || !Array.isArray(SITE_CONFIG.plans) || !SITE_CONFIG.plans.length) return;
  const fragment = document.createDocumentFragment();
  SITE_CONFIG.plans.forEach((plan) => {
    const card = createNode("article", `price-card${plan.featured ? " featured" : ""}`);
    card.dataset.reveal = "";
    card.append(
      createNode("span", "price-tag", plan.featured ? "Recomendado" : "Plano"),
      createNode("h3", "", plan.name),
      createNode("p", "price-desc", plan.description)
    );
    const price = createNode("div", "price-value");
    price.append(createNode("strong", "", plan.price), createNode("small", "", "por projeto"));
    card.append(price);
    if (plan.idealFor) {
      const audience = createNode("p", "price-audience");
      audience.append(createNode("span", "", "Ideal para"), document.createTextNode(plan.idealFor));
      card.append(audience);
    }
    card.append(createNode("p", "price-includes", "O que está incluído"));
    const features = createNode("ul", "price-features");
    (plan.features || []).forEach((feature) => {
      if (typeof feature === "string") {
        features.append(createNode("li", "", feature));
      } else if (feature?.title) {
        const item = createNode("li");
        item.append(createNode("strong", "price-feature-title", feature.title));
        if (feature.description) item.append(createNode("span", "price-feature-description", feature.description));
        features.append(item);
      }
    });
    card.append(features);
    const link = createNode("a", "button button-primary price-button", `Escolher ${plan.name} `);
    link.href = "#contato";
    link.dataset.plan = plan.name;
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("class", "arrow");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.setAttribute("aria-hidden", "true");
    const arrowUse = document.createElementNS("http://www.w3.org/2000/svg", "use");
    arrowUse.setAttribute("href", "#icon-arrow");
    arrow.append(arrowUse);
    link.append(arrow);
    card.append(link);
    fragment.append(card);
  });
  grid.replaceChildren(fragment);
}

function initializePlanSelection() {
  const select = query('select[name="plano"]');
  const hint = query("#contactPlanHint");
  if (!select) return;
  const updateHint = () => {
    if (!hint) return;
    const selected = select.selectedOptions[0];
    hint.textContent = select.value && selected ? `Seu interesse: ${selected.textContent.trim()}` : "Você também pode escolher o plano depois de conversarmos";
  };
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[data-plan]") : null;
    if (!link) return;
    const option = [...select.options].find((item) => item.value === link.dataset.plan || item.value.startsWith(`${link.dataset.plan} `));
    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  select.addEventListener("change", updateHint);
  select.form?.addEventListener("reset", () => { queueMicrotask(updateHint); });
  updateHint();
}

function initializeMenu() {
  const button = query(".menu-toggle");
  const menu = query("#mobileMenu");
  if (!button || !menu) return;
  const desktop = window.matchMedia("(min-width: 900px)");
  button.setAttribute("aria-controls", menu.id);
  const close = ({ restoreFocus = false, desktopFocus = false } = {}) => {
    const focusedLink = menu.contains(document.activeElement) ? document.activeElement : null;
    const focusInNavigation = focusedLink || document.activeElement === button;
    menu.hidden = true;
    menu.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Abrir menu");
    document.body.classList.remove("menu-open");
    if (desktopFocus && focusInNavigation) {
      const href = focusedLink?.getAttribute("href");
      const replacement = queryAll(".site-header nav:not(#mobileMenu) a").find((link) => link.getAttribute("href") === href);
      (replacement || query(".site-header a"))?.focus({ preventScroll: true });
    } else if (restoreFocus) button.focus({ preventScroll: true });
  };
  close();
  button.addEventListener("click", () => {
    if (!menu.hidden) {
      close({ restoreFocus: true });
      return;
    }
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Fechar menu");
    document.body.classList.add("menu-open");
  });
  menu.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (!link) return;
    const href = link.getAttribute("href") || "";
    close({ restoreFocus: !href.startsWith("#") });
    if (href.startsWith("#") && href.length > 1) {
      const target = document.getElementById(href.slice(1));
      if (target) {
        if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
        requestAnimationFrame(() => { target.focus({ preventScroll: true }); });
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      close({ restoreFocus: true });
    }
  });
  document.addEventListener("focusin", (event) => {
    if (!menu.hidden && event.target !== button && !menu.contains(event.target)) close();
  });
  desktop.addEventListener("change", (event) => { if (event.matches) close({ desktopFocus: true }); });
}

function setStatus(element, message, state) {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
  element.classList.toggle("is-success", state === "success");
  element.classList.toggle("is-error", state === "error");
}

function requestErrorMessage(status, kind) {
  if (status === 429) return "Você enviou várias solicitações, aguarde alguns minutos e tente novamente";
  if (status === 400) return "Revise os campos do formulário e tente novamente";
  if (status === 503) return "O envio por e-mail está indisponível no momento, mas você pode falar com a gente pelo WhatsApp";
  return kind === "review" ? "Não foi possível enviar sua avaliação agora, tente novamente mais tarde" : "Não foi possível enviar sua mensagem agora, tente novamente ou fale com a gente pelo WhatsApp";
}

function initializeForm({ selector, statusSelector, endpoint, kind, successMessage, onSuccess }) {
  const form = query(selector);
  const status = query(statusSelector);
  if (!form) return;
  let sending = false;
  const submit = form.querySelector('button[type="submit"], input[type="submit"]');
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const body = JSON.stringify(Object.fromEntries(new FormData(form)));
    const originalNodes = submit instanceof HTMLButtonElement ? [...submit.childNodes] : null;
    const originalValue = submit instanceof HTMLInputElement ? submit.value : null;
    const originalDisabled = submit?.disabled || false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { controller.abort(); }, 20000);
    sending = true;
    form.setAttribute("aria-busy", "true");
    if (submit) {
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      if (originalNodes) submit.textContent = "Enviando…";
      else if (originalValue !== null) submit.value = "Enviando…";
    }
    setStatus(status, kind === "review" ? "Enviando sua avaliação…" : "Enviando sua mensagem…", "pending");
    try {
      const configuredAction = new URL(form.getAttribute("action") || endpoint, window.location.href);
      const action = configuredAction.origin === window.location.origin ? configuredAction.pathname : endpoint;
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        setStatus(status, requestErrorMessage(response.status, kind), "error");
        return;
      }
      form.reset();
      onSuccess?.();
      setStatus(status, successMessage, "success");
    } catch (error) {
      const message = error.name === "AbortError" ? "O envio demorou mais que o esperado, tente novamente ou fale com a gente pelo WhatsApp" : requestErrorMessage(0, kind);
      setStatus(status, message, "error");
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      form.removeAttribute("aria-busy");
      if (submit) {
        submit.disabled = originalDisabled;
        submit.removeAttribute("aria-busy");
        if (originalNodes) submit.replaceChildren(...originalNodes);
        else if (originalValue !== null) submit.value = originalValue;
      }
      notifyLayoutChange();
    }
  });
}

function initializeReview() {
  const wrapper = query("#reviewFormWrap");
  const openButton = query("#openReviewForm");
  const closeButton = query("#closeReviewForm");
  const form = query("#reviewForm");
  if (!wrapper || !openButton || !form) return;
  const setOpen = (open) => {
    const hadFocus = wrapper.contains(document.activeElement);
    wrapper.hidden = !open;
    wrapper.setAttribute("aria-hidden", String(!open));
    openButton.setAttribute("aria-expanded", String(open));
    openButton.setAttribute("aria-controls", wrapper.id);
    if (open) form.querySelector('input[name="nome"]')?.focus({ preventScroll: true });
    else if (hadFocus) openButton.focus({ preventScroll: true });
    notifyLayoutChange();
  };
  const updateRating = () => {
    const selected = Number(form.querySelector('input[name="nota"]:checked')?.value || 0);
    form.querySelectorAll(".review-rating label").forEach((label) => {
      const input = label.control || label.querySelector('input[name="nota"]');
      label.classList.toggle("is-selected", Boolean(selected) && Number(input?.value) <= selected);
    });
  };
  setOpen(false);
  openButton.addEventListener("click", () => { setOpen(wrapper.hidden); });
  closeButton?.addEventListener("click", () => { setOpen(false); });
  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  });
  form.addEventListener("change", updateRating);
  form.addEventListener("reset", () => { queueMicrotask(updateRating); });
  updateRating();
  initializeForm({
    selector: "#reviewForm",
    statusSelector: "#reviewFormStatus",
    endpoint: "/api/enviar-avaliacao",
    kind: "review",
    successMessage: "Avaliação enviada para análise — obrigado por compartilhar sua experiência",
    onSuccess: updateRating
  });
}

function redirectLegacyProject() {
  const project = new URLSearchParams(window.location.search).get("projeto");
  const routes = new Map([
    ["barbearia", "/demos/barbearia.html"],
    ["petshop", "/demos/petshop.html"],
    ["restaurante", "/demos/restaurante.html"]
  ]);
  if (routes.has(project)) window.location.replace(routes.get(project));
}

// Navigation and forms are initialized before optional motion is loaded.
applySiteConfig();
renderPlans();
initializePlanSelection();
initializeMenu();
initializeForm({
  selector: "#contactForm",
  statusSelector: "#formStatus",
  endpoint: "/api/enviar-contato",
  kind: "contact",
  successMessage: "Mensagem enviada! Vamos entrar em contato para conversar sobre seu projeto"
});
initializeReview();
redirectLegacyProject();

let stopAnimations = () => {};
const startAnimations = (skipIntro = false) => {
  stopAnimations();
  stopAnimations = initAnimations({ skipIntro });
};
if (document.readyState === "complete") startAnimations();
else window.addEventListener("load", () => { startAnimations(); }, { once: true });
window.addEventListener("pagehide", () => { stopAnimations(); });
window.addEventListener("pageshow", (event) => { if (event.persisted) startAnimations(true); });
