import { Resend } from "resend";

const MAX_BODY_BYTES = 32 * 1024;

export function json(status, body) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function parseFormRequest(request) {
  if (request.method !== "POST") {
    return { response: json(405, { success: false, error: "Método não permitido." }) };
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { response: json(415, { success: false, error: "Envie os dados em formato JSON." }) };
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return { response: json(400, { success: false, error: "Não foi possível ler os dados." }) };
  }

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return { response: json(413, { success: false, error: "Mensagem muito grande." }) };
  }

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Formato inválido");
    }
    return { data };
  } catch {
    return { response: json(400, { success: false, error: "Dados inválidos." }) };
  }
}

export function field(data, key, maxLength = 5000) {
  const value = data[key];
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function paragraph(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export async function sendEmail({ subject, html, replyTo, kind }) {
  const { RESEND_API_KEY, EMAIL_SUPORTE, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_SUPORTE || !EMAIL_FROM) {
    return json(503, {
      success: false,
      error: kind === "review"
        ? "O envio de avaliações ainda não foi configurado."
        : "O formulário está preparado, mas o envio de e-mail ainda não foi configurado."
    });
  }

  try {
    const client = new Resend(RESEND_API_KEY);
    const message = {
      from: EMAIL_FROM,
      to: [EMAIL_SUPORTE],
      subject,
      html
    };
    if (replyTo) message.replyTo = replyTo;

    const { error } = await client.emails.send(message);
    if (error) {
      console.error("[RESEND]", error);
      return json(502, {
        success: false,
        error: kind === "review"
          ? "Não foi possível enviar sua avaliação agora."
          : "Não foi possível enviar sua mensagem agora."
      });
    }
    return json(200, { success: true });
  } catch (error) {
    console.error("[EMAIL]", error);
    return json(500, {
      success: false,
      error: kind === "review"
        ? "Ocorreu um erro ao enviar sua avaliação."
        : "Ocorreu um erro ao enviar sua mensagem."
    });
  }
}
