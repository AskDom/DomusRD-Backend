const express = require('express');
const router  = express.Router();
const {
  createProperty, getProperties, getPropertyById,
  updateProperty, deleteProperty,
} = require('../controllers/property.controller');
const { protect, requireRole, requireVerifiedEmail } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { createPropertyValidator, updatePropertyValidator } = require('../middlewares/validators');

// Públicas
router.get('/',    getProperties);
router.get('/:id', getPropertyById);

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