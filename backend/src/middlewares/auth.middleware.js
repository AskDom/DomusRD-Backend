const jwt = require('jsonwebtoken');

// ── MIDDLEWARE 1: Verifica que el token JWT sea válido ────────────────────────
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // decoded tiene: { userId, role }  ← el rol viene en MAYÚSCULAS (VENDEDOR, AGENTE, CLIENTE)
      req.user = { userId: decoded.id, email: decoded.email, role: decoded.role };
      return next();
    } catch (error) {
      console.log('❌ JWT verify falló:', error.name, '-', error.message);
      return res.status(401).json({ error: 'No autorizado, token inválido o expirado.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'No autorizado, no se proporcionó ningún token.' });
  }
};

// ── MIDDLEWARE 1b: Auth opcional — decodifica el token si viene, pero no
// rechaza la petición si no hay token o es inválido. Para rutas públicas
// (listado/detalle de propiedades) donde el controller necesita saber si
// hay sesión para decidir cuánto detalle devolver (p.ej. ubicación exacta).
const attachUserIfPresent = (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer')) {
    try {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { userId: decoded.id, email: decoded.email, role: decoded.role };
    } catch {
      // Token inválido/expirado — seguimos como visitante anónimo, sin romper la petición.
    }
  }
  next();
};

// ── MIDDLEWARE 2: Verifica que el usuario tenga uno de los roles permitidos ───
// Uso: requireRole('VENDEDOR', 'AGENTE')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Acceso denegado. Se requiere uno de los siguientes roles: ${roles.join(', ')}.`,
      tuRol: req.user.role,
    });
  }
  next();
};

// ── MIDDLEWARE 3: Verifica que el usuario sea dueño del recurso ───────────────
// Uso: en el controller, después de buscar la propiedad
const isOwner = (resourceUserId, req, res) => {
  if (req.user.userId !== resourceUserId) {
    res.status(403).json({ error: 'No tienes permiso para modificar esta propiedad.' });
    return false;
  }
  return true;
};

module.exports = { protect, attachUserIfPresent, requireRole, isOwner };