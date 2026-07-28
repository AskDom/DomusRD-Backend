const express = require('express');
const router  = express.Router();
const {
  createProperty, getProperties, getPropertyById,
  updateProperty, deleteProperty,
} = require('../controllers/property.controller');
const { protect, attachUserIfPresent, requireRole, requireVerifiedEmail } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { createPropertyValidator, updatePropertyValidator } = require('../middlewares/validators');

// Públicas — pero attachUserIfPresent deja saber al controller si hay sesión,
// para decidir cuánto detalle de ubicación devolver.
router.get('/',    attachUserIfPresent, getProperties);
router.get('/:id', attachUserIfPresent, getPropertyById);

// Protegidas
router.post('/',
  protect,
  requireRole('VENDEDOR', 'AGENTE', 'ADMIN'),
  requireVerifiedEmail,
  createPropertyValidator, validate,
  createProperty
);

router.put('/:id',
  protect,
  requireRole('VENDEDOR', 'AGENTE', 'ADMIN'),
  updatePropertyValidator, validate,
  updateProperty
);

router.delete('/:id',
  protect,
  requireRole('VENDEDOR', 'AGENTE', 'ADMIN'),
  deleteProperty
);

module.exports = router;