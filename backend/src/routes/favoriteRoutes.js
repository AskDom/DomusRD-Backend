const express    = require('express');
const router     = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// Importamos el controller y verificamos que las funciones existen
const favoriteController = require('../controllers/favorite.controller');
const { getFavorites, addFavorite, removeFavorite } = favoriteController;

if (!getFavorites || !addFavorite || !removeFavorite) {
  console.error('❌ favoriteController exports:', Object.keys(favoriteController));
  throw new Error('favorite.controller.js no exporta las funciones correctas');
}

const { validate } = require('../middlewares/validate.middleware');
const { favoriteParamValidator } = require('../middlewares/validators');

router.use(protect);
router.get('/',               getFavorites);
router.post('/:propertyId',   favoriteParamValidator, validate, addFavorite);
router.delete('/:propertyId', favoriteParamValidator, validate, removeFavorite);

module.exports = router;