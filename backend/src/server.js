require("dotenv").config();
require("./config/sentry"); // Cargar antes que todo lo demás para capturar cualquier error temprano.
const http        = require("http");
const { Server }  = require("socket.io");
const jwt         = require("jsonwebtoken");
const cookie       = require("cookie");
const { COOKIE_NAME } = require("./utils/authCookie");
const logger = require("./config/logger");

if (!process.env.JWT_SECRET) {
  logger.error("JWT_SECRET no está definida. Configúrala en .env antes de arrancar el servidor.");
  process.exit(1);
}

const app    = require("./app");
const server = http.createServer(app);

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
// Mismo criterio que el CORS de Express en app.js: FRONTEND_URL puede traer
// varios orígenes separados por coma, comparados por igualdad exacta.
const socketAllowedOrigins = [
  ...(process.env.FRONTEND_URL || "").split(",").map((o) => o.trim()).filter(Boolean),
  "http://localhost:3000",
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.startsWith("http://localhost") || socketAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS bloqueado para: ${origin}`));
    },
    methods:     ["GET", "POST"],
    credentials: true,
  },
});

// Mapa userId → socketId para enviar mensajes directos
const onlineUsers = new Map();

io.use((socket, next) => {
  // La app móvil manda el token por handshake.auth (no maneja cookies).
  // El frontend web ya no tiene el token en JS — el navegador manda la
  // cookie httpOnly sola en el handshake HTTP inicial (necesita
  // "withCredentials: true" del lado del cliente, ver socket.io-client).
  let token = socket.handshake.auth?.token;
  if (!token) {
    const rawCookies = socket.handshake.headers.cookie;
    if (rawCookies) token = cookie.parseCookie(rawCookies)[COOKIE_NAME];
  }
  if (!token) return next(new Error("No autorizado"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    socket.userId = decoded.id || decoded.userId;
    socket.role   = decoded.role;
    next();
  } catch {
    next(new Error("Token inválido"));
  }
});

io.on("connection", (socket) => {
  logger.debug("Socket conectado", { userId: socket.userId });
  onlineUsers.set(socket.userId, socket.id);

  // Unirse a sala personal para recibir mensajes directos
  socket.join(`user:${socket.userId}`);

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.userId);
    logger.debug("Socket desconectado", { userId: socket.userId });
  });
});

// Exportar io para usarlo en los controllers
app.set("io", io);
app.set("onlineUsers", onlineUsers);

// ── START ─────────────────────────────────────────────────────────────────────
const prisma = require("./config/prisma");
const PORT   = process.env.PORT || 5000;

prisma.$connect()
  .then(() => {
    logger.info("Conectado a PostgreSQL");
    server.listen(PORT, () => {
      logger.info(`Servidor Domify corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Error conectando a PostgreSQL", err);
    process.exit(1);
  });
