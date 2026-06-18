const express = require('express');
const router = express.Router();
const { 
  createProperty, 
  getProperties, 
  getPropertyById, 
  updateProperty, 
  deleteProperty 
} = require('../controllers/property.controller');

// Importamos el guardián que acabamos de crear
const { protect } = require('../middlewares/auth.middleware');

// --- RUTAS PÚBLICAS (Cualquiera las puede ver) ---
router.get('/', getProperties);
router.get('/:id', getPropertyById);

// --- RUTAS PROTEGIDAS (Requieren token válido) ---
router.post('/', protect, createProperty);   // <-- Guardián activo
router.put('/:id', protect, updateProperty);   // <-- Guardián activo
router.delete('/:id', protect, deleteProperty); // <-- Guardián activo

module.exports = router;