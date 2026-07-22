const rateLimit = require('express-rate-limit');

// Limita intentos de login/registro por IP para dificultar ataques de fuerza bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

module.exports = { authLimiter };
