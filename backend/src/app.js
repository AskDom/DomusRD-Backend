const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const helmet       = require("helmet");
const path         = require("path");
const rateLimit    = require("express-rate-limit");
const pinoHttp     = require("pino-http");
const logger       = require("./config/logger");

const app = express();

// ── LOGGING DE REQUESTS ──────────────────────────────────────────────────────
// Un log por request (método, ruta, status, duración) — antes no había
// ningún rastro de los flujos normales, solo lo que cada controller
// logueaba a mano en sus catch. autoLogging igual respeta el level del
// logger, así que en producción (level "info") esto sigue viéndose.
app.use(pinoHttp({ logger: logger.raw }));

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
// contentSecurityPolicy off: es una API JSON, no sirve HTML — el CSP que
// importa es el del frontend (ver public/index.html en el repo web).
app.use(helmet({ contentSecurityPolicy: false }));
// Lista explícita de orígenes confiables. FRONTEND_URL puede traer varios
// separados por coma (ej. dominio propio + preview de Vercel del equipo),
// pero cada uno se compara por igualdad exacta — nunca por substring, para
// no terminar confiando en cualquier "*.vercel.app" ajeno.
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || "").split(",").map((o) => o.trim()).filter(Boolean),
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith("http://localhost")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const onlineUsers = req.app.get("onlineUsers");
  res.json({ status: "ok", message: "Domify API funcionando 🏠", onlineUsers: onlineUsers ? onlineUsers.size : 0 });
});

// ── RATE LIMITING ────────────────────────────────────────────────────────────
// Auth: máximo 10 intentos por 15 minutos por IP
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message:          { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) => process.env.NODE_ENV === "development",
});

// API general: máximo 100 requests por minuto por IP
const apiLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              100,
  message:          { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) => process.env.NODE_ENV === "development",
});

// Upload: máximo 20 imágenes por hora por IP
const uploadLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              20,
  message:          { error: "Límite de subida de imágenes alcanzado. Intenta en una hora." },
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) => process.env.NODE_ENV === "development",
});

// ── RUTAS ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",       authLimiter,   require(path.join(__dirname, "routes", "authRoutes.js")));
app.use("/api/properties", apiLimiter,    require(path.join(__dirname, "routes", "propertyRoutes.js")));
app.use("/api/upload",     uploadLimiter, require(path.join(__dirname, "routes", "uploadRoutes.js")));
app.use("/api/favorites",  apiLimiter,    require(path.join(__dirname, "routes", "favoriteRoutes.js")));
app.use("/api/messages",   apiLimiter,    require(path.join(__dirname, "routes", "messageRoutes.js")));
app.use("/api/admin",      apiLimiter,    require(path.join(__dirname, "routes", "adminRoutes.js")));
app.use("/api/reviews",    apiLimiter,    require(path.join(__dirname, "routes", "reviewRoutes.js")));
app.use("/api/users",      apiLimiter,    require(path.join(__dirname, "routes", "userRoutes.js")));
app.use("/api/saved-searches", apiLimiter, require(path.join(__dirname, "routes", "savedSearchRoutes.js")));
app.use("/api/notifications", apiLimiter, require(path.join(__dirname, "routes", "notificationRoutes.js")));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error("Error no manejado", err, { path: req.path, method: req.method });
  const isProd = process.env.NODE_ENV === "production";
  const message = (!isProd && err.message) || "Error interno del servidor";
  res.status(err.status || 500).json({ error: message });
});

module.exports = app;
