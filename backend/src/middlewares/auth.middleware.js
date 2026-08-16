const jwt = require('jsonwebtoken');
const { COOKIE_NAME } = require('../utils/authCookie');
const prisma = require('../config/prisma');

// Métodos que cambian estado — les exigimos un header custom cuando la
// autenticación viene de la cookie, para frenar CSRF. Un <form>/<img> de
// otro sitio no puede agregar headers propios, así que esto no le sirve
// a un atacante; un cliente Bearer (la app móvil) no usa cookie, así que
// no le aplica esta exigencia.
const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Busca el token en el header Authorization (app móvil / clientes Bearer)
// y si no está, en la cookie httpOnly (frontend web). Devuelve también de
// dónde salió, porque la cookie necesita el chequeo CSRF de más abajo.
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer')) {
    return { token: header.split(' ')[1], source: 'header' };
  }
  if (req.cookies?.[COOKIE_NAME]) {
    return { token: req.cookies[COOKIE_NAME], source: 'cookie' };
  }
  return { token: null, source: null };
}

// ── MIDDLEWARE 1: Verifica que el token JWT sea válido ────────────────────────
const protect = async (req, res, next) => {
  const { token, source } = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'No autorizado, no se proporcionó ningún token.' });
  }

  if (source === 'cookie' && UNSAFE_METHODS.includes(req.method) && !req.headers['x-domify-client']) {
    return res.status(403).json({ error: 'Falta el header requerido para esta petición.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    // El token trae su propio "tv" (tokenVersion) de cuando se emitió —
    // comparado contra el valor actual en la base, esto es lo que permite
    // revocar el token antes de que expire por su cuenta (logout, cambio de
    // contraseña, cambio de rol por un admin — ver dónde se incrementa
    // tokenVersion en auth.controller.js y admin.controller.js). De paso,
    // usamos el rol FRESCO de la base en vez del que venía en el token, así
    // que un cambio de rol aplica de inmediato y no recién cuando expire el
    // JWT viejo.
    const user = await prisma.user.findUnique({
      where:  { id: decoded.id },
      select: { role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== decoded.tv) {
      return res.status(401).json({ error: 'Sesión inválida, iniciá sesión de nuevo.' });
    }

    // decoded tiene: { userId, role }  ← el rol viene en MAYÚSCULAS (VENDEDOR, AGENTE, CLIENTE)
    req.user = { userId: decoded.id, email: decoded.email, role: user.role };
    return next();
  } catch (error) {
    console.log('❌ JWT verify falló:', error.name, '-', error.message);
    return res.status(401).json({ error: 'No autorizado, token inválido o expirado.' });
  }
};

// ── MIDDLEWARE 1b: Auth opcional — decodifica el token si viene, pero no
// rechaza la petición si no hay token o es inválido. Para rutas públicas
// (listado/detalle de propiedades) donde el controller necesita saber si
// hay sesión para decidir cuánto detalle devolver (p.ej. ubicación exacta).
//
// Importante: valida el token contra la base (tokenVersion) igual que
// protect(). Antes esto solo decodificaba el JWT sin mirar la DB, así que
// un token de una sesión revocada (logout, cambio de contraseña/rol)
// seguía "abriendo" la ubicación exacta hasta que expirara solo — hasta 7
// días después. Es una consulta puntual por id (índice primario), no una
// query pesada.
const attachUserIfPresent = async (req, res, next) => {
  const { token } = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      const user = await prisma.user.findUnique({
        where:  { id: decoded.id },
        select: { role: true, tokenVersion: true },
      });
      if (user && user.tokenVersion === decoded.tv) {
        // Rol fresco de la base, no el del token.
        req.user = { userId: decoded.id, email: decoded.email, role: user.role };
      }
    } catch {
      // Token inválido/expirado, o usuario borrado/revocado — seguimos como
      // visitante anónimo, sin romper la petición.
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
  // ADMIN pasa el chequeo de dueño para poder moderar publicaciones ajenas
  // (editar/borrar). Sin este caso especial no había forma de moderar
  // contenido de otro usuario aunque el rol existiera para eso.
  if (req.user.role !== 'ADMIN' && req.user.userId !== resourceUserId) {
    res.status(403).json({ error: 'No tienes permiso para modificar esta propiedad.' });
    return false;
  }
  return true;
};

module.exports = { protect, attachUserIfPresent, requireRole, isOwner };