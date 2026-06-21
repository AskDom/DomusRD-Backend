const { verifyToken } = require("../utils/jwt");

// Verifica que el request tenga un JWT válido y adjunta req.user
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// Verifica que el usuario tenga uno de los roles permitidos
// Uso: requireRole("AGENTE", "VENDEDOR")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso denegado. Roles permitidos: ${allowedRoles.join(", ")}`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
