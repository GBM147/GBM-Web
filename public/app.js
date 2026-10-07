import { SITE_CONFIG } from "./site-config.js";
import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.15.0/index.js";
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.15.0/ScrollTrigger.js";

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-brand]").forEach((el) => el.textContent = SITE_CONFIG.brand);
document.querySelectorAll("[data-descriptor]").forEach((el) => el.textContent = SITE_CONFIG.descriptor);
document.querySelectorAll("[data-location]").forEach((el) => el.textContent = SITE_CONFIG.location);

const pricingGrid = document.querySelector("#pricingGrid");
pricingGrid.innerHTML = SITE_CONFIG.plans.map((plan) => `
  <article class="price-card ${plan.featured ? "featured" : ""} reveal">
    <span class="price-tag">${plan.featured ? "Mais escolhido" : "Plano"}</span>
    <h3>${plan.name}</h3>
    <p class="price-desc">${plan.description}</p>
    <div class="price-value"><strong>${plan.price}</strong><small>à vista*</small></div>
    <ul class="price-features">
      ${plan.features.map((feature) => `<li>${feature}</li>`).join("")}
    </ul>
    <a class="button button-primary price-button" href="#contato" data-plan="${plan.name}">Escolher ${plan.name} <span>↗</span></a>
  </article>
`).join("");

document.querySelectorAll("[data-plan]").forEach((link) => {
  link.addEventListener("click", () => {
    const select = document.querySelector('select[name="plano"]');
    const planName = link.dataset.plan;
    if (select && planName) {
      const option = [...select.options].find((item) => item.value.startsWith(planName));
      if (option) select.value = option.value;
    }
  });
});

const menuButton = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector("#mobileMenu");

function closeMenu() {
  document.body.classList.remove("menu-open");
  menuButton.setAttribute("aria-expanded", "false");
  gsap.to(mobileMenu, { autoAlpha: 0, y: -10, duration: .25, ease: "power2.out" });
}

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  if (isOpen) {
    closeMenu();
    return;
  }
  document.body.classList.add("menu-open");
  menuButton.setAttribute("aria-expanded", "true");
  gsap.to(mobileMenu, { autoAlpha: 1, y: 0, duration: .3, ease: "power3.out" });
});

mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

const contactForm = document.querySelector("#contactForm");
const formStatus = document.querySelector("#formStatus");

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = contactForm.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.innerHTML = "Enviando...";

  try {
    const response = await fetch("/api/enviar-contato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(contactForm)))
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Não foi possível enviar.");
    }

    contactForm.reset();
    formStatus.textContent = "Mensagem enviada. Vou entrar em contato em breve.";
    formStatus.style.color = "#b79cff";
  } catch (error) {
    formStatus.textContent = error.message || "Não foi possível enviar agora.";
    formStatus.style.color = "#ffaaa8";
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Enviar mensagem <span>↗</span>';
  }
});

if (!reducedMotion) {
  const intro = gsap.timeline({
    defaults: { ease: "power3.out" }
  });

  intro
    .from(".site-header", { y: -22, autoAlpha: 0, duration: .6 })
    .from(".hero .eyebrow", { y: 24, autoAlpha: 0, duration: .65 }, "-=.25")
    .from(".hero-line", { yPercent: 110, autoAlpha: 0, duration: .9, stagger: .11, ease: "power4.out" }, "-=.3")
    .from(".hero-subtitle", { y: 24, autoAlpha: 0, duration: .7 }, "-=.55")
    .from(".hero-actions", { y: 24, autoAlpha: 0, duration: .65 }, "-=.45")
    .from(".hero-proof", { y: 18, autoAlpha: 0, duration: .55 }, "-=.35")
    .from(".browser-window", { y: 45, rotation: 8, scale: .96, autoAlpha: 0, duration: 1.15, ease: "power3.out" }, "-=.8")
    .from(".floating-tag", { y: 22, scale: .88, autoAlpha: 0, duration: .55, stagger: .12 }, "-=.75");

  gsap.to(".browser-window", {
    y: -10,
    duration: 3.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".orb-one", {
    x: 22,
    y: 16,
    duration: 5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".orb-two", {
    x: -18,
    y: -12,
    duration: 6,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".marquee-track", {
    xPercent: -18,
    ease: "none",
    scrollTrigger: {
      trigger: ".marquee-band",
      start: "top bottom",
      end: "bottom top",
      scrub: true
    }
  });

  gsap.utils.toArray(".reveal").forEach((element) => {
    if (element.closest(".hero")) return;
    gsap.fromTo(element,
      { y: 35, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: .8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 86%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });

  gsap.utils.toArray(".service-card").forEach((card, index) => {
    gsap.fromTo(card,
      { y: 28, scale: .985 },
      {
        y: 0,
        scale: 1,
        duration: .8,
        delay: index * .04,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card,
          start: "top 88%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });

  gsap.utils.toArray(".process-item").forEach((item) => {
    const number = item.querySelector("span");
    gsap.from(number, {
      x: -14,
      autoAlpha: 0,
      duration: .55,
      scrollTrigger: { trigger: item, start: "top 88%", toggleActions: "play none none reverse" }
    });
  });

  document.querySelectorAll(".magnetic").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      gsap.to(button, { x: x * .08, y: y * .12, duration: .35, ease: "power3.out" });
    });
    button.addEventListener("pointerleave", () => {
      gsap.to(button, { x: 0, y: 0, duration: .5, ease: "elastic.out(1,.5)" });
    });
  });
}

window.addEventListener("load", () => ScrollTrigger.refresh());


const projectData = {
  barbearia: {
    kicker: "DEMO / BARBEARIA",
    title: "Seu estilo começa aqui.",
    description: "Uma experiência digital pensada para transformar a busca por um corte em agendamento. Visual marcante, serviços organizados e contato imediato.",
    structure: "Serviços + horários",
    focus: "Agendamento",
    experience: "Mobile first",
    theme: "modal-barbearia",
    cta: "Quero este projeto"
  },
  petshop: {
    kicker: "DEMO / PET SHOP",
    title: "Cuidado de verdade.",
    description: "Um site acolhedor para apresentar produtos, serviços e atendimento, passando confiança para quem procura cuidar melhor do seu pet.",
    structure: "Serviços + contato",
    focus: "Confiança",
    experience: "Navegação simples",
    theme: "modal-petshop",
    cta: "Quero este projeto"
  },
  restaurante: {
    kicker: "DEMO / RESTAURANTE",
    title: "Sabor que fica na memória.",
    description: "Uma presença digital criada para destacar o cardápio, abrir o caminho até o restaurante e facilitar pedidos e reservas.",
    structure: "Cardápio + localização",
    focus: "Pedidos",
    experience: "Rápida e visual",
    theme: "modal-restaurante",
    cta: "Quero este projeto"
  }
};

const projectModal = document.querySelector("#projectModal");
const modalPreview = document.querySelector("#projectModalPreview");
const modalKicker = document.querySelector("#projectModalKicker");
const modalTitle = document.querySelector("#projectModalTitle");
const modalDescription = document.querySelector("#projectModalDescription");
const modalStructure = document.querySelector("#projectModalStructure");
const modalFocus = document.querySelector("#projectModalFocus");
const modalExperience = document.querySelector("#projectModalExperience");
const modalCta = document.querySelector("#projectModalCta");

function openProjectModal(projectKey) {
  const project = projectData[projectKey];
  if (!project || !projectModal) return;

  modalKicker.textContent = project.kicker;
  modalTitle.textContent = project.title;
  modalDescription.textContent = project.description;
  modalStructure.textContent = project.structure;
  modalFocus.textContent = project.focus;
  modalExperience.textContent = project.experience;
  modalCta.textContent = project.cta;
  const arrow = document.createElement("span");
  arrow.textContent = "↗";
  modalCta.appendChild(arrow);

  modalPreview.className = "project-modal-preview " + project.theme;
  modalPreview.innerHTML = `
    <div class="modal-preview-window">
      <div class="modal-browser"><i></i><i></i><i></i><b>${projectKey}.gbmweb.com.br</b></div>
      <div class="modal-preview-screen">
        <small>${project.kicker.replace("DEMO / ","")}</small>
        <strong>${project.title}</strong>
        <span>CONHECER PROJETO ↗</span>
      </div>
    </div>
  `;

  projectModal.classList.add("is-open");
  projectModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  if (!reducedMotion) {
    gsap.fromTo(".project-modal-panel",
      { y: 30, scale: .97, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: .45, ease: "power3.out" }
    );
    gsap.fromTo("#projectModalPreview .modal-preview-window",
      { rotate: -6, scale: .94 },
      { rotate: -2, scale: 1, duration: .6, ease: "power3.out" }
    );
  }
  setTimeout(() => document.querySelector(".project-modal-close")?.focus(), 30);
}

function closeProjectModal() {
  if (!projectModal) return;
  if (!reducedMotion) {
    gsap.to(".project-modal-panel", {
      y: 20, scale: .98, autoAlpha: 0, duration: .22, ease: "power2.in",
      onComplete: finishCloseProjectModal
    });
  } else {
    finishCloseProjectModal();
  }
}

function finishCloseProjectModal() {
  projectModal.classList.remove("is-open");
  projectModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

document.querySelectorAll(".project-card[data-project]").forEach((card) => {
  const activate = () => openProjectModal(card.dataset.project);
  card.addEventListener("click", activate);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
});

document.querySelectorAll("[data-modal-close]").forEach((element) => {
  element.addEventListener("click", (event) => {
    if (element.tagName === "A" && element.getAttribute("href") === "#contato") return;
    event.preventDefault();
    closeProjectModal();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && projectModal?.classList.contains("is-open")) closeProjectModal();
});

const projectFromUrl = new URLSearchParams(window.location.search).get("projeto");
if (projectFromUrl && projectData[projectFromUrl]) {
  window.addEventListener("load", () => openProjectModal(projectFromUrl));
}

modalCta?.addEventListener("click", () => closeProjectModal());



const reviewFormWrap = document.querySelector("#reviewFormWrap");
const openReviewFormButton = document.querySelector("#openReviewForm");
const closeReviewFormButton = document.querySelector("#closeReviewForm");
const reviewRatingInput = document.querySelector("#reviewRatingInput");
const reviewRatingButtons = [...document.querySelectorAll(".review-rating button")];
const reviewForm = document.querySelector("#reviewForm");
const reviewFormStatus = document.querySelector("#reviewFormStatus");

function setReviewRating(rating) {
  const value = String(Math.max(1, Math.min(5, Number(rating) || 5)));
  if (reviewRatingInput) reviewRatingInput.value = value;
  reviewRatingButtons.forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.rating) <= Number(value));
  });
}

setReviewRating(5);

openReviewFormButton?.addEventListener("click", () => {
  reviewFormWrap?.classList.add("is-open");
  reviewFormWrap?.setAttribute("aria-hidden", "false");
  setTimeout(() => reviewForm?.querySelector("input[name=nome]")?.focus(), 30);
});

closeReviewFormButton?.addEventListener("click", () => {
  reviewFormWrap?.classList.remove("is-open");
  reviewFormWrap?.setAttribute("aria-hidden", "true");
});

reviewRatingButtons.forEach((button) => {
  button.addEventListener("mouseenter", () => setReviewRating(button.dataset.rating));
  button.addEventListener("click", () => setReviewRating(button.dataset.rating));
});

reviewForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = reviewForm.querySelector("button[type=submit]");
  if (!submit) return;

  submit.disabled = true;
  submit.textContent = "Enviando...";
  if (reviewFormStatus) reviewFormStatus.textContent = "";

  try {
    const response = await fetch("/api/enviar-avaliacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(reviewForm)))
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Não foi possível enviar a avaliação.");
    }

    reviewForm.reset();
    setReviewRating(5);
    if (reviewFormStatus) {
      reviewFormStatus.textContent = "Avaliação enviada para análise. Obrigado pelo feedback.";
      reviewFormStatus.style.color = "#6f4e8f";
    }
  } catch (error) {
    if (reviewFormStatus) {
      reviewFormStatus.textContent = error.message || "Não foi possível enviar agora.";
      reviewFormStatus.style.color = "#a44";
    }
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Enviar avaliação <span>↗</span>';
  }
});
