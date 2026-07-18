require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const path       = require("path");
const http       = require("http");
const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");

const app    = express();
const server = http.createServer(app);

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      process.env.FRONTEND_URL || "http://localhost:3000",
    methods:     ["GET", "POST"],
    credentials: true,
  },
});

// Mapa userId → socketId para enviar mensajes directos
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No autorizado"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_fallback");
    socket.userId = decoded.id || decoded.userId;
    socket.role   = decoded.role;
    next();
  } catch {
    next(new Error("Token inválido"));
  }
});

io.on("connection", (socket) => {
  console.log(`🔌 Conectado: ${socket.userId}`);
  onlineUsers.set(socket.userId, socket.id);

  // Unirse a sala personal para recibir mensajes directos
  socket.join(`user:${socket.userId}`);

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.userId);
    console.log(`🔌 Desconectado: ${socket.userId}`);
  });
});

// Exportar io para usarlo en los controllers
app.set("io", io);
app.set("onlineUsers", onlineUsers);

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

// ── RUTA TEMPORAL ADMIN (BORRAR ANTES DE PRODUCCIÓN) ─────────────────────────
app.get("/dev/make-admin/:email", async (req, res) => {
  const prisma = require("./config/prisma");
  try {
    const user = await prisma.user.update({
      where:  { email: req.params.email },
      data:   { role: "ADMIN" },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "DomusRD API funcionando 🏠", onlineUsers: onlineUsers.size });
});

// ── RUTAS ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",       require(path.join(__dirname, "routes", "authRoutes.js")));
app.use("/api/properties", require(path.join(__dirname, "routes", "propertyRoutes.js")));
app.use("/api/upload",     require(path.join(__dirname, "routes", "uploadRoutes.js")));
app.use("/api/favorites",  require(path.join(__dirname, "routes", "favoriteRoutes.js")));
app.use("/api/messages",   require(path.join(__dirname, "routes", "messageRoutes.js")));
app.use("/api/admin",      require(path.join(__dirname, "routes", "adminRoutes.js")));
app.use("/api/reviews",    require(path.join(__dirname, "routes", "reviewRoutes.js")));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Error interno" });
});

// ── START ─────────────────────────────────────────────────────────────────────
const prisma = require("./config/prisma");
const PORT   = process.env.PORT || 5000;

prisma.$connect()
  .then(() => {
    console.log("✅ Conectado a PostgreSQL");
    server.listen(PORT, () => {
      console.log(`🚀 Servidor DomusRD corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error conectando a PostgreSQL:", err.message);
    process.exit(1);
  });