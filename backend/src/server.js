require("dotenv").config();
const http        = require("http");
const { Server }  = require("socket.io");
const jwt         = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET no está definida. Configúrala en .env antes de arrancar el servidor.");
  process.exit(1);
}

const app    = require("./app");
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
