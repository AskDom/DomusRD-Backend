const { body, param, query } = require('express-validator');

// Solo aceptamos imágenes que vengan de nuestro propio cloud de Cloudinary
// (subidas via /api/upload) — sin esto, el body podía traer cualquier URL
// externa u otro esquema como "imagen" de una propiedad.
const isOwnCloudinaryImageUrl = (url) => {
  if (typeof url !== 'string') return false;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const prefix = cloudName
    ? `https://res.cloudinary.com/${cloudName}/image/upload/`
    : 'https://res.cloudinary.com/'; // sin cloud name configurado (ej. tests), al menos exige el host
  return url.startsWith(prefix);
};

// .trim() es un SANITIZER, no un validador — si no es string, lo convierte
// a string en vez de rechazarlo (un body como { title: {"a":1} } terminaba
// guardado como el texto literal "[object Object]"). .isString() antes de
// cada .trim() cierra eso: si no es string, corta ahí con un 400 limpio.
const STRING_MSG = 'Debe ser texto';

// ── AUTH ──────────────────────────────────────────────────────────────────────
const registerValidator = [
  body('name')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres'),

  body('email')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El correo es requerido')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 8, max: 72 }).withMessage('La contraseña debe tener entre 8 y 72 caracteres'),

  body('role')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .custom((val) => {
      const valid = ['CLIENTE', 'VENDEDOR', 'AGENTE', 'Cliente', 'Vendedor', 'Agente'];
      if (val && !valid.includes(val)) throw new Error('Rol inválido');
      return true;
    }),
];

const loginValidator = [
  body('email')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El correo es requerido')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida'),
];

const forgotPasswordValidator = [
  body('email')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El correo es requerido')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('token')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El token es requerido'),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 8, max: 72 }).withMessage('La contraseña debe tener entre 8 y 72 caracteres'),
];

// PATCH /api/users/me — todos los campos opcionales; cambiar la contraseña
// exige currentPassword + newPassword (validado en el controller).
const updateMeValidator = [
  body('name')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El nombre no puede estar vacío')
    .isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres'),

  body('email')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El correo no puede estar vacío')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),

  body('currentPassword')
    .optional()
    .isString().withMessage(STRING_MSG),

  body('newPassword')
    .optional()
    .isString().withMessage(STRING_MSG)
    .isLength({ min: 8, max: 72 }).withMessage('La contraseña debe tener entre 8 y 72 caracteres'),
];

// ── PROPERTIES ────────────────────────────────────────────────────────────────
const createPropertyValidator = [
  body('title')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El título es requerido')
    .isLength({ min: 5, max: 120 }).withMessage('El título debe tener entre 5 y 120 caracteres'),

  body('description')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('La descripción es requerida')
    .isLength({ min: 10, max: 2000 }).withMessage('La descripción debe tener entre 10 y 2000 caracteres'),

  body('price')
    .notEmpty().withMessage('El precio es requerido')
    .isFloat({ min: 1 }).withMessage('El precio debe ser mayor a 0'),

  body('currency')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isIn(['USD', 'DOP']).withMessage('Moneda inválida'),

  body('city')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('La ciudad es requerida')
    .isLength({ max: 80 }).withMessage('La ciudad no puede exceder 80 caracteres'),

  body('sector')
    .optional({ checkFalsy: true })
    .isString().withMessage(STRING_MSG)
    .trim()
    .isLength({ max: 80 }).withMessage('El sector no puede exceder 80 caracteres'),

  body('lat')
    .notEmpty().withMessage('La latitud es requerida')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),

  body('lng')
    .notEmpty().withMessage('La longitud es requerida')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),

  body('rooms')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Habitaciones debe ser entre 1 y 20'),

  body('baths')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Baños debe ser entre 1 y 20'),

  body('parking')
    .optional()
    .isInt({ min: 0, max: 20 }).withMessage('Parqueos debe ser entre 0 y 20'),

  body('type')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isIn(['APARTAMENTO', 'CASA', 'VILLA', 'Apartamento', 'Casa', 'Villa'])
    .withMessage('Tipo de propiedad inválido'),

  body('status')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isIn(['VENTA', 'RENTA', 'VENDIDO', 'RENTADO', 'Venta', 'Renta'])
    .withMessage('Estado de propiedad inválido'),

  body('images')
    .optional()
    .isArray().withMessage('Las imágenes deben ser un array')
    .custom((arr) => {
      if (arr.length > 6) throw new Error('Máximo 6 imágenes por propiedad');
      if (!arr.every(isOwnCloudinaryImageUrl)) {
        throw new Error('Las imágenes deben ser URLs subidas a través de Domify');
      }
      return true;
    }),

  body('userId')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isUUID().withMessage('userId inválido'),

  body('publishedById')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isUUID().withMessage('publishedById inválido'),
];

const updatePropertyValidator = [
  param('id').isUUID().withMessage('ID de propiedad inválido'),

  body('title')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isLength({ min: 5, max: 120 }).withMessage('El título debe tener entre 5 y 120 caracteres'),

  body('price')
    .optional()
    .isFloat({ min: 1 }).withMessage('El precio debe ser mayor a 0'),

  body('currency')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isIn(['USD', 'DOP']).withMessage('Moneda inválida'),

  body('sector')
    .optional({ checkFalsy: true })
    .isString().withMessage(STRING_MSG)
    .trim()
    .isLength({ max: 80 }).withMessage('El sector no puede exceder 80 caracteres'),

  body('description')
    .optional()
    .isString().withMessage(STRING_MSG)
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage('La descripción debe tener entre 10 y 2000 caracteres'),

  body('images')
    .optional()
    .isArray().withMessage('Las imágenes deben ser un array')
    .custom((arr) => {
      if (arr.length > 6) throw new Error('Máximo 6 imágenes por propiedad');
      if (!arr.every(isOwnCloudinaryImageUrl)) {
        throw new Error('Las imágenes deben ser URLs subidas a través de Domify');
      }
      return true;
    }),
];

// Filtros de listado (GET /api/properties) — sin esto, algo como
// "?city[$gte]=" llega como objeto anidado (así parsea Express el query
// string con corchetes) hasta el where() de Prisma, que revienta con un
// error no capturado (500) en vez de un 400 normal.
const listPropertiesValidator = [
  query('city').optional().isString().withMessage(STRING_MSG),
  query('search').optional().isString().withMessage(STRING_MSG),
  query('type').optional().isString().withMessage(STRING_MSG),
  query('status').optional().isString().withMessage(STRING_MSG),
  query('rooms').optional().isInt({ min: 1 }).withMessage('rooms inválido'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice inválido'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice inválido'),
  query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit inválido'),
  query('bbox').optional().isString().withMessage(STRING_MSG),
  query('publishedBy').optional().isUUID().withMessage('publishedBy inválido'),
  // Comma-separated list of UUIDs, usada para traer favoritos de un golpe.
  query('ids')
    .optional({ values: "falsy" })
    .isString().withMessage(STRING_MSG)
    .custom((val) => {
      const ids = String(val).split(',').filter(Boolean);
      if (!ids.length) throw new Error('ids inválido');
      if (!ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
        throw new Error('ids debe ser una lista de UUIDs separados por coma');
      }
      return true;
    }),
];

// ── REVIEWS ───────────────────────────────────────────────────────────────────
const reviewValidator = [
  param('propertyId').isUUID().withMessage('ID de propiedad inválido'),

  body('rating')
    .notEmpty().withMessage('La calificación es requerida')
    .isInt({ min: 1, max: 5 }).withMessage('La calificación debe ser entre 1 y 5'),

  body('comment')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El comentario es requerido')
    .isLength({ min: 5, max: 500 }).withMessage('El comentario debe tener entre 5 y 500 caracteres'),
];

// ── MESSAGES ──────────────────────────────────────────────────────────────────
const sendMessageValidator = [
  body('toId')
    .notEmpty().withMessage('El destinatario es requerido')
    .isUUID().withMessage('ID de destinatario inválido'),

  body('propertyId')
    .notEmpty().withMessage('La propiedad es requerida')
    .isUUID().withMessage('ID de propiedad inválido'),

  body('text')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('El mensaje no puede estar vacío')
    .isLength({ max: 1000 }).withMessage('El mensaje no puede exceder 1000 caracteres'),
];

// ── FAVORITES ─────────────────────────────────────────────────────────────────
const favoriteParamValidator = [
  param('propertyId').isUUID().withMessage('ID de propiedad inválido'),
];

// ── SAVED SEARCHES ────────────────────────────────────────────────────────────
const createSavedSearchValidator = [
  body('name')
    .isString().withMessage(STRING_MSG)
    .trim()
    .notEmpty().withMessage('Ponle un nombre a la búsqueda.')
    .isLength({ max: 100 }).withMessage('El nombre no puede exceder 100 caracteres'),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateMeValidator,
  createPropertyValidator,
  updatePropertyValidator,
  listPropertiesValidator,
  favoriteParamValidator,
  reviewValidator,
  sendMessageValidator,
  createSavedSearchValidator,
};
