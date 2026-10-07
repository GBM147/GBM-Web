const path = require("node:path");
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Resend } = require("resend");

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_DIR = path.join(__dirname, "public");

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "gbm-web",
    timestamp: new Date().toISOString()
  });
});

const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Muitas avaliações enviadas. Aguarde alguns minutos e tente novamente."
  }
});

app.post("/api/enviar-avaliacao", reviewLimiter, async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const empresa = String(req.body.empresa || "").trim();
  const segmento = String(req.body.segmento || "").trim();
  const depoimento = String(req.body.depoimento || "").trim();
  const nota = Math.max(1, Math.min(5, Number(req.body.nota) || 0));
  const honeypot = String(req.body.website || "").trim();

  if (honeypot) return res.json({ success: true });

  if (!nome || !empresa || !depoimento || !Number.isInteger(nota) || !nota) {
    return res.status(400).json({
      success: false,
      error: "Preencha nome, empresa, nota e depoimento."
    });
  }

  if (!resend || !process.env.EMAIL_SUPORTE || !process.env.EMAIL_FROM) {
    return res.status(503).json({
      success: false,
      error: "O envio de avaliações ainda não foi configurado."
    });
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
      <p>${escapeHtml(depoimento).replace(/\n/g, "<br>")}</p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [process.env.EMAIL_SUPORTE],
      subject: `Nova avaliação GBM Web — ${nota}/5 — ${nome}`,
      html
    });

    if (error) {
      console.error("[RESEND REVIEW]", error);
      return res.status(502).json({
        success: false,
        error: "Não foi possível enviar sua avaliação agora."
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("[REVIEW]", error);
    return res.status(500).json({
      success: false,
      error: "Ocorreu um erro ao enviar sua avaliação."
    });
  }
});

app.post("/api/enviar-contato", contactLimiter, async (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim();
  const empresa = String(req.body.empresa || "").trim();
  const telefone = String(req.body.telefone || "").trim();
  const plano = String(req.body.plano || "").trim();
  const mensagem = String(req.body.mensagem || "").trim();
  const honeypot = String(req.body.website || "").trim();

  if (honeypot) {
    return res.json({ success: true });
  }

  if (!nome || !email || !mensagem) {
    return res.status(400).json({
      success: false,
      error: "Preencha nome, e-mail e mensagem."
    });
  }

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido) {
    return res.status(400).json({
      success: false,
      error: "Informe um e-mail válido."
    });
  }

  if (!resend || !process.env.EMAIL_SUPORTE || !process.env.EMAIL_FROM) {
    return res.status(503).json({
      success: false,
      error: "O formulário está preparado, mas o envio de e-mail ainda não foi configurado."
    });
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
      <p>${escapeHtml(mensagem).replace(/\n/g, "<br>")}</p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [process.env.EMAIL_SUPORTE],
      replyTo: email,
      subject: `Novo contato GBM Web — ${nome}`,
      html
    });

    if (error) {
      console.error("[RESEND]", error);
      return res.status(502).json({
        success: false,
        error: "Não foi possível enviar sua mensagem agora."
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("[CONTACT]", error);
    return res.status(500).json({
      success: false,
      error: "Ocorreu um erro ao enviar sua mensagem."
    });
  }
});

app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"]
}));

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GBM Web rodando na porta ${PORT}`);
  });
}

module.exports = { app };
