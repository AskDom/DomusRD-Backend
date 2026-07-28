const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });

  // El código ya loguea sus errores de forma consistente con
  // console.error("mensaje", error) en cada catch. En vez de tocar cada
  // controller uno por uno, reenviamos automáticamente a Sentry cualquier
  // console.error que reciba un objeto Error entre sus argumentos.
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError(...args);
    const error = args.find((arg) => arg instanceof Error);
    if (error) Sentry.captureException(error);
  };

  console.log("✅ Sentry inicializado");
}

module.exports = Sentry;
