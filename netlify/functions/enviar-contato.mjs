import { json, parseFormRequest, field, escapeHtml, paragraph, sendEmail } from "../mail.mjs";

export default async function handler(request) {
  const { data, response } = await parseFormRequest(request);
  if (response) return response;

  // Campo oculto: não responde a bots que preenchem campos não visíveis.
  if (field(data, "website")) return json(200, { success: true });

  const nome = field(data, "nome", 200);
  const email = field(data, "email", 254);
  const empresa = field(data, "empresa", 200);
  const telefone = field(data, "telefone", 80);
  const plano = field(data, "plano", 120);
  const mensagem = field(data, "mensagem");

  if (!nome || !email || !mensagem) {
    return json(400, { success: false, error: "Preencha nome, e-mail e mensagem." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { success: false, error: "Informe um e-mail válido." });
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#15151c">
      <h2>Novo contato — GBM Web</h2>
      <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p><strong>Empresa:</strong> ${escapeHtml(empresa || "Não informado")}</p>
      <p><strong>Telefone:</strong> ${escapeHtml(telefone || "Não informado")}</p>
      <p><strong>Plano de interesse:</strong> ${escapeHtml(plano || "Não informado")}</p>
      <hr>
      <p><strong>Mensagem:</strong></p>
      <p>${paragraph(mensagem)}</p>
    </div>
  `;

  return sendEmail({
    subject: `Novo contato GBM Web — ${nome}`,
    html,
    replyTo: email,
    kind: "contact"
  });
}

// Proteção na borda do Netlify, independente de memória entre invocações.
export const config = {
  path: "/api/enviar-contato",
  method: "POST",
  rateLimit: { windowLimit: 6, windowSize: 180, aggregateBy: ["ip", "domain"] }
};
