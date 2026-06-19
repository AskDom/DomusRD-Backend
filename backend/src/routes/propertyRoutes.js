const express = require('express');
const router  = express.Router();
const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');

const { protect, requireRole } = require('../middlewares/auth.middleware');

// ── RUTAS PÚBLICAS ────────────────────────────────────────────────────────────
router.get('/',    getProperties);
router.get('/:id', getPropertyById);

// ── RUTAS PROTEGIDAS ──────────────────────────────────────────────────────────
// Solo VENDEDOR y AGENTE pueden crear propiedades
router.post(
  '/',
  protect,
  requireRole('VENDEDOR', 'AGENTE'),
  createProperty
);

// Solo el dueño puede editar (la verificación de dueño está en el controller)
router.put(
  '/:id',
  protect,
  requireRole('VENDEDOR', 'AGENTE'),
  updateProperty
);

// Solo el dueño puede eliminar (la verificación de dueño está en el controller)
router.delete(
  '/:id',
  protect,
  requireRole('VENDEDOR', 'AGENTE'),
  deleteProperty
);

module.exports = router;