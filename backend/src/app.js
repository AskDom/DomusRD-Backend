const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const rateLimit = require("express-rate-limit");

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.startsWith("http://localhost")) return callback(null, true);
    if (origin.includes("vercel.app")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const onlineUsers = req.app.get("onlineUsers");
  res.json({ status: "ok", message: "DomusRD API funcionando 🏠", onlineUsers: onlineUsers ? onlineUsers.size : 0 });
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
app.use("/api/admin",      require(path.join(__dirname, "routes", "adminRoutes.js")));
app.use("/api/reviews",    apiLimiter,    require(path.join(__dirname, "routes", "reviewRoutes.js")));
app.use("/api/users",      apiLimiter,    require(path.join(__dirname, "routes", "userRoutes.js")));
app.use("/api/saved-searches", apiLimiter, require(path.join(__dirname, "routes", "savedSearchRoutes.js")));
app.use("/api/notifications", apiLimiter, require(path.join(__dirname, "routes", "notificationRoutes.js")));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Error interno" });
});

module.exports = app;
