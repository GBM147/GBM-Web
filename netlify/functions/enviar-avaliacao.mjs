import { json, parseFormRequest, field, escapeHtml, paragraph, sendEmail } from "../mail.mjs";

export default async function handler(request) {
  const { data, response } = await parseFormRequest(request);
  if (response) return response;

  if (field(data, "website")) return json(200, { success: true });

  const nome = field(data, "nome", 200);
  const empresa = field(data, "empresa", 200);
  const segmento = field(data, "segmento", 200);
  const depoimento = field(data, "depoimento");
  const nota = Number(data.nota);

  if (!nome || !empresa || !depoimento || !Number.isInteger(nota) || nota < 1 || nota > 5) {
    return json(400, { success: false, error: "Preencha nome, empresa, nota e depoimento." });
  }

  const estrelas = "★".repeat(nota) + "☆".repeat(5 - nota);
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#15151c">
      <h2>Nova avaliação — GBM Web</h2>
      <p><strong>Nota:</strong> ${estrelas} (${nota}/5)</p>
      <p><strong>Cliente:</strong> ${escapeHtml(nome)}</p>
      <p><strong>Empresa:</strong> ${escapeHtml(empresa)}</p>
      <p><strong>Segmento:</strong> ${escapeHtml(segmento || "Não informado")}</p>
      <hr>
      <p><strong>Depoimento:</strong></p>
      <p>${paragraph(depoimento)}</p>
    </div>
  `;

  return sendEmail({
    subject: `Nova avaliação GBM Web — ${nota}/5 — ${nome}`,
    html,
    kind: "review"
  });
}

export const config = {
  path: "/api/enviar-avaliacao",
  method: "POST",
  rateLimit: { windowLimit: 5, windowSize: 180, aggregateBy: ["ip", "domain"] }
};
