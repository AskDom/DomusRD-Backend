const express    = require('express');
const router     = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const logger = require('../config/logger');

// Importamos el controller y verificamos que las funciones existen
const favoriteController = require('../controllers/favorite.controller');
const { getFavorites, addFavorite, removeFavorite } = favoriteController;

if (!getFavorites || !addFavorite || !removeFavorite) {
  logger.error('favorite.controller.js no exporta las funciones correctas', undefined, { exports: Object.keys(favoriteController) });
  throw new Error('favorite.controller.js no exporta las funciones correctas');
}

router.use(protect);
router.get('/',               getFavorites);
router.post('/:propertyId',   addFavorite);
router.delete('/:propertyId', removeFavorite);

module.exports = router;