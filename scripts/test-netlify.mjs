import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import contact from "../netlify/functions/enviar-contato.mjs";
import review from "../netlify/functions/enviar-avaliacao.mjs";
import health from "../netlify/functions/health.mjs";
import { escapeHtml } from "../netlify/mail.mjs";

const request = (endpoint, body, contentType = "application/json") =>
  new Request("https://example.netlify.app" + endpoint, {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

test("health mantém contrato público", async () => {
  const res = health();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.service, "gbm-web");
});

test("contato exige campos e e-mail válido", async () => {
  const missing = await contact(request("/api/enviar-contato", { nome: "A" }));
  assert.equal(missing.status, 400);
  const invalid = await contact(request("/api/enviar-contato", {
    nome: "A", email: "invalido", mensagem: "Oi"
  }));
  assert.equal(invalid.status, 400);
});

test("avaliações só aceitam nota inteira de 1 a 5", async () => {
  for (const nota of [0, 6, 3.5, "abc"]) {
    const res = await review(request("/api/enviar-avaliacao", {
      nome: "A", empresa: "Empresa", depoimento: "Ótimo", nota
    }));
    assert.equal(res.status, 400);
  }
});

test("API rejeita JSON malformado e payload inadequado", async () => {
  assert.equal((await contact(request("/api/enviar-contato", "{"))).status, 400);
  assert.equal((await review(request("/api/enviar-avaliacao", {}, "text/plain"))).status, 415);
  assert.equal((await contact(request("/api/enviar-contato", {
    nome: "A", email: "a@b.com", mensagem: "x".repeat(33000)
  }))).status, 413);
});

test("honeypot evita envios e preserva resposta amigável", async () => {
  for (const [handler, endpoint] of [
    [contact, "/api/enviar-contato"], [review, "/api/enviar-avaliacao"]
  ]) {
    const res = await handler(request(endpoint, { website: "spam.com" }));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).success, true);
  }
});

test("envio sem Resend configurado retorna 503, nunca sucesso falso", async () => {
  const variables = ["RESEND_API_KEY", "EMAIL_SUPORTE", "EMAIL_FROM"];
  const saved = Object.fromEntries(variables.map((name) => [name, process.env[name]]));
  for (const name of variables) delete process.env[name];
  try {
    assert.equal((await contact(request("/api/enviar-contato", {
      nome: "A", email: "a@b.com", mensagem: "Olá"
    }))).status, 503);
    assert.equal((await review(request("/api/enviar-avaliacao", {
      nome: "A", empresa: "Empresa", depoimento: "Ótimo", nota: 5
    }))).status, 503);
  } finally {
    for (const name of variables) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});

test("HTML de e-mails é escapado", () => {
  assert.equal(escapeHtml('<script>"&'), "&lt;script&gt;&quot;&amp;");
});

test("build gera os arquivos GSAP necessários", () => {
  for (const name of ["gsap.min.js", "ScrollTrigger.min.js"]) {
    assert.equal(fs.existsSync(new URL("../public/vendor/gsap/" + name, import.meta.url)), true);
  }
});
