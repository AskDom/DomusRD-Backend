const { body, param } = require('express-validator');

// ── AUTH ──────────────────────────────────────────────────────────────────────
const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres'),

  body('email')
    .trim()
    .notEmpty().withMessage('El correo es requerido')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 5 }).withMessage('La contraseña debe tener al menos 5 caracteres'),

  body('role')
    .optional()
    .trim()
    .custom((val) => {
      const valid = ['CLIENTE', 'VENDEDOR', 'AGENTE', 'Cliente', 'Vendedor', 'Agente'];
      if (val && !valid.includes(val)) throw new Error('Rol inválido');
      return true;
    }),
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo es requerido')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida'),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('El correo es requerido')
    .isEmail().withMessage('El correo no es válido')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty().withMessage('El token es requerido'),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 5 }).withMessage('La contraseña debe tener al menos 5 caracteres'),
];

// ── PROPERTIES ────────────────────────────────────────────────────────────────
const createPropertyValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('El título es requerido')
    .isLength({ min: 5, max: 120 }).withMessage('El título debe tener entre 5 y 120 caracteres'),

  body('description')
    .trim()
    .notEmpty().withMessage('La descripción es requerida')
    .isLength({ min: 10, max: 2000 }).withMessage('La descripción debe tener entre 10 y 2000 caracteres'),

  body('price')
    .notEmpty().withMessage('El precio es requerido')
    .isFloat({ min: 1 }).withMessage('El precio debe ser mayor a 0'),

  body('city')
    .trim()
    .notEmpty().withMessage('La ciudad es requerida')
    .isLength({ max: 80 }).withMessage('La ciudad no puede exceder 80 caracteres'),

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
    .trim()
    .isIn(['APARTAMENTO', 'CASA', 'VILLA', 'Apartamento', 'Casa', 'Villa'])
    .withMessage('Tipo de propiedad inválido'),

  body('status')
    .optional()
    .trim()
    .isIn(['VENTA', 'RENTA', 'VENDIDO', 'RENTADO', 'Venta', 'Renta'])
    .withMessage('Estado de propiedad inválido'),

  body('images')
    .optional()
    .isArray().withMessage('Las imágenes deben ser un array')
    .custom((arr) => {
      if (arr.length > 6) throw new Error('Máximo 6 imágenes por propiedad');
      return true;
    }),

  body('userId')
    .optional()
    .trim()
    .isUUID().withMessage('userId inválido'),

  body('publishedById')
    .optional()
    .trim()
    .isUUID().withMessage('publishedById inválido'),
];

const updatePropertyValidator = [
  param('id').isUUID().withMessage('ID de propiedad inválido'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 120 }).withMessage('El título debe tener entre 5 y 120 caracteres'),

  body('price')
    .optional()
    .isFloat({ min: 1 }).withMessage('El precio debe ser mayor a 0'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage('La descripción debe tener entre 10 y 2000 caracteres'),

  body('images')
    .optional()
    .isArray().withMessage('Las imágenes deben ser un array')
    .custom((arr) => {
      if (arr.length > 6) throw new Error('Máximo 6 imágenes por propiedad');
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
    .trim()
    .notEmpty().withMessage('El mensaje no puede estar vacío')
    .isLength({ max: 1000 }).withMessage('El mensaje no puede exceder 1000 caracteres'),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  createPropertyValidator,
  updatePropertyValidator,
  reviewValidator,
  sendMessageValidator,
};