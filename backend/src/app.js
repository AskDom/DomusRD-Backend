const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const helmet       = require("helmet");
const path         = require("path");
const rateLimit    = require("express-rate-limit");
const fs           = require("fs");
const yaml         = require("js-yaml");
const swaggerUi    = require("swagger-ui-express");

const app = express();

// Render pone un único proxy inverso delante de la app. Sin esto, el rate
// limiter de abajo agrupa a todos los usuarios bajo la IP del proxy en vez
// de la IP real del cliente (bloqueando login para todo el mundo a la vez).
app.set("trust proxy", 1);

// ── DOCS ──────────────────────────────────────────────────────────────────────
// docs/openapi.yaml describe cada endpoint a mano (no autogenerado desde
// JSDoc) — con ~30 rutas repartidas en 10 archivos, mantenerlo como un
// archivo separado es más simple de revisar en un solo lugar que anotar
// cada route una por una.
// Solo se exponen fuera de producción: en producción la UI de Swagger
// revelaría toda la superficie de la API a cualquiera.
if (process.env.SWAGGER_ENABLED === "true") {
  const openapiDocument = yaml.load(fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.yaml"), "utf8"));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
// contentSecurityPolicy off: es una API JSON, no sirve HTML — el CSP que
// importa es el del frontend (ver public/index.html en el repo web).
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
// Lista explícita de orígenes confiables. FRONTEND_URL puede traer varios
// separados por coma (ej. dominio propio + preview de Vercel del equipo),
// pero cada uno se compara por igualdad exacta — nunca por substring, para
// no terminar confiando en cualquier "*.vercel.app" ajeno.
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || "").split(",").map((o) => o.trim()).filter(Boolean),
  "http://localhost:3000",
];

// Match exacto de "http://localhost:<puerto>" — nunca startsWith, que dejaría
// pasar orígenes como "http://localhost.atacante.com".
const isLocalhostOrigin = (origin) => /^http:\/\/localhost:\d+$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    // Sin cabecera Origin no hay request cross-origin de navegador: así hablan
    // las apps móviles (React Native nunca manda Origin), los health checks del
    // hosting y curl. Rechazarlos acá los rompía todos con un 500 en
    // producción. El CSRF sigue cubierto por la cookie SameSite=Lax + el
    // header x-domify-client obligatorio en métodos inseguros (auth.middleware).
    if (!origin) return callback(null, true);
    if (isLocalhostOrigin(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));
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
  skip: (req) => process.env.NODE_ENV === "test",
});

// API general: máximo 100 requests por minuto por IP
const apiLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              100,
  message:          { error: "Demasiadas peticiones. Intenta de nuevo en un momento." },
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) => process.env.NODE_ENV === "test",
});

// Upload: máximo 20 imágenes por hora por IP
const uploadLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              20,
  message:          { error: "Límite de subida de imágenes alcanzado. Intenta en una hora." },
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) => process.env.NODE_ENV === "test",
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
app.use("/api/visits",        apiLimiter, require(path.join(__dirname, "routes", "visitRoutes.js")));

// ── TASAS DE CAMBIO ───────────────────────────────────────────────────────────
// Pública y barata: solo lee una constante del entorno. La consumen la web y
// la app móvil para mostrar equivalencias de precio en moneda local.
const { getRates } = require(path.join(__dirname, "utils", "fx"));
app.get("/api/rates", (req, res) => res.json(getRates()));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  const isProd = process.env.NODE_ENV === "production";
  const message = (!isProd && err.message) || "Error interno del servidor";
  res.status(err.status || 500).json({ error: message });
});

module.exports = app;
