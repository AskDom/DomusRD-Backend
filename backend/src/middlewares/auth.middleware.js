const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
  let token;

  // 1. Verificamos si el token viene en los Headers con el formato 'Bearer TOKEN'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Separamos la palabra 'Bearer' del token real
      token = req.headers.authorization.split(' ')[1];

      // Verificamos y decodificamos el token usando nuestra clave secreta
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_temporal_domusrd');

      // Inyectamos los datos del usuario decodificado en la petición (req.user)
      req.user = decoded;

      // ¡Todo bien! Dejamos pasar la petición al controlador
      return next();
    } catch (error) {
      console.error("Error al validar el token:", error);
      return res.status(401).json({ error: 'No autorizado, token inválido o expirado.' });
    }
  }

  // 2. Si no llegó ningún token
  if (!token) {
    return res.status(401).json({ error: 'No autorizado, no se proporcionó ningún token.' });
  }
};

module.exports = { protect };
