require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ── MIDDLEWARE ──────────────────────────────────────────────────────────
// Configuración robusta de CORS apuntando a tu Frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// ── HEALTH CHECK ────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "DomusRD API funcionando 🏠" });
});

// ── RUTAS ───────────────────────────────────────────────────────────────
// Ruta de Autenticación
app.use("/api/auth", require(path.join(__dirname, "routes", "authRoutes.js")));

// Ruta de Propiedades
app.use("/api/properties", require(path.join(__dirname, "routes", "propertyRoutes.js")));

// ── 404 NOT FOUND ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ── ERROR HANDLER GLOBAL ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Error interno del servidor",
  });
});

// ── START SERVER ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor DomusRD corriendo en http://localhost:${PORT}`);
});