require("dotenv").config();
require("./config/sentry"); // Cargar antes que todo lo demás para capturar cualquier error temprano.
const http        = require("http");
const { Server }  = require("socket.io");
const jwt         = require("jsonwebtoken");
const cookie       = require("cookie");
const prisma       = require("./config/prisma");
const { COOKIE_NAME } = require("./utils/authCookie");

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET no está definida. Configúrala en .env antes de arrancar el servidor.");
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

// Match exacto de "http://localhost:<puerto>" — nunca startsWith, que dejaría
// pasar orígenes como "http://localhost.atacante.com".
const isLocalhostOrigin = (origin) => /^http:\/\/localhost:\d+$/.test(origin);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isLocalhostOrigin(origin) || socketAllowedOrigins.includes(origin)) {
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

io.use(async (socket, next) => {
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

    // Misma validación que protect() en auth.middleware.js: el token trae su
    // propio "tv" (tokenVersion) y lo comparamos contra el valor actual en la
    // base. Sin esto, un JWT revocado (logout, cambio de contraseña, cambio de
    // rol por un admin) seguía con el socket conectado hasta que expirara solo
    // — hasta 7 días después — aunque la API HTTP ya lo rechazara.
    const user = await prisma.user.findUnique({
      where:  { id: decoded.id },
      select: { role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== decoded.tv) {
      return next(new Error("Sesión inválida"));
    }

    socket.userId = decoded.id;
    socket.role   = user.role;
    next();
  } catch (error) {
    // jwt.verify falló (token inválido/expirado) o la consulta a la base
    // falló — en ambos casos cerramos por defecto: no aceptar un socket con
    // un token que no pudimos verificar contra la base.
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

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

prisma.$connect()
  .then(() => {
    console.log("✅ Conectado a PostgreSQL");
    server.listen(PORT, () => {
      console.log(`🚀 Servidor Domify corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error conectando a PostgreSQL:", err.message);
    process.exit(1);
  });
