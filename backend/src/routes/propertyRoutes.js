const express = require('express');
const router = express.Router();
const { 
  createProperty, 
  getProperties, 
  getPropertyById, 
  updateProperty, 
  deleteProperty 
} = require('../controllers/property.controller');

// Rutas generales
router.post('/', createProperty);
router.get('/', getProperties);

// Rutas específicas con ID (Siempre abajo)
router.get('/:id', getPropertyById);
router.put('/:id', updateProperty);    // <-- Para actualizar
router.delete('/:id', deleteProperty); // <-- Para eliminar

module.exports = router;