const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });

  // El reenvío a Sentry ya no pasa por acá parcheando console.error — ahora
  // es explícito en logger.error() (ver src/config/logger.js), que es lo
  // que usan los controllers.
  console.log("✅ Sentry inicializado");
}

module.exports = Sentry;
