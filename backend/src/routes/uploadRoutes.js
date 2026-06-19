const express = require('express');
const router  = express.Router();
const { upload }       = require('../config/cloudinary');
const { uploadImages, deleteImage } = require('../controllers/upload.controller');
const { protect, requireRole } = require('../middlewares/auth.middleware');

// Solo usuarios autenticados con rol VENDEDOR o AGENTE pueden subir fotos
router.post(
  '/',
  protect,
  requireRole('VENDEDOR', 'AGENTE'),
  upload.array('images', 6),  // campo "images", máximo 6 archivos
  uploadImages
);

// Eliminar una imagen por URL
router.delete(
  '/',
  protect,
  requireRole('VENDEDOR', 'AGENTE'),
  deleteImage
);

module.exports = router;