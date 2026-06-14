require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ── MIDDLEWARE ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// ── HEALTH CHECK ────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "DomusRD API funcionando 🏠" });
});

// ── RUTAS (se agregarán en los siguientes pasos) ───────────────────────
// app.use("/api/auth", require("./routes/auth.routes"));
// app.use("/api/properties", require("./routes/properties.routes"));
// app.use("/api/messages", require("./routes/messages.routes"));

// ── 404 ─────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ── ERROR HANDLER ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Error interno del servidor",
  });
});

// ── START ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor DomusRD corriendo en http://localhost:${PORT}`);
});
