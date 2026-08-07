const { Resend } = require("resend");
const logger = require("../config/logger");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = process.env.MAIL_FROM || "Domify <onboarding@resend.dev>";

async function sendPasswordResetEmail(to, resetUrl) {
  if (!resend) {
    // Sin API key configurada (p.ej. en desarrollo local) no rompemos el flujo,
    // solo dejamos el link visible en logs para poder probar manualmente.
    logger.warn("RESEND_API_KEY no configurada — link de reseteo solo en logs", { resetUrl });
    return;
  }

  await resend.emails.send({
    from:    FROM,
    to,
    subject: "Recupera tu contraseña — Domify",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Recupera tu contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Domify.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block; background:#1a56db; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            Restablecer contraseña
          </a>
        </p>
        <p>Este enlace expira en 1 hora. Si no solicitaste esto, puedes ignorar este correo.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
