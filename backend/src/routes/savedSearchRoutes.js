const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { createSavedSearchValidator } = require('../middlewares/validators');
const { getSavedSearches, createSavedSearch, deleteSavedSearch } = require('../controllers/savedSearch.controller');

// Todas requieren estar autenticado — son búsquedas privadas del usuario
router.use(protect);

router.get('/',     getSavedSearches);
router.post('/',    createSavedSearchValidator, validate, createSavedSearch);
router.delete('/:id', deleteSavedSearch);

module.exports = router;
