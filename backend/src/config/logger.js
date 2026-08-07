const pino = require("pino");
const Sentry = require("./sentry");

const isProd = process.env.NODE_ENV === "production";

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  // El JWT viaja en la cookie o en Authorization — pino-http loguea el
  // objeto `req` completo en cada request, así que sin esto el token
  // terminaría en texto plano en cada línea de log.
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
    censor: "[REDACTED]",
  },
  // pino-pretty solo como devDependency — en producción se loguea JSON
  // plano de una línea, pensado para que lo levante un agregador de logs.
  transport: isProd ? undefined : {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
  },
});

// Reemplaza el patrón `console.error("mensaje:", error)` que se repetía en
// cada controller. A diferencia del monkey-patch de console.error que hacía
// esto antes en sentry.js, acá el reenvío a Sentry queda explícito: solo se
// dispara si realmente se logueó un Error.
function error(message, err, extra = {}) {
  pinoLogger.error({ ...extra, err }, message);
  if (err instanceof Error) Sentry.captureException(err);
}

module.exports = {
  info:  (message, extra) => pinoLogger.info(extra || {}, message),
  warn:  (message, extra) => pinoLogger.warn(extra || {}, message),
  debug: (message, extra) => pinoLogger.debug(extra || {}, message),
  error,
  raw: pinoLogger, // instancia de pino sin envolver, para pino-http en app.js
};
