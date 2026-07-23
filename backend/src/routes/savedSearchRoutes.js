const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getSavedSearches, createSavedSearch, deleteSavedSearch } = require('../controllers/savedSearch.controller');

// Todas requieren estar autenticado — son búsquedas privadas del usuario
router.use(protect);

router.get('/',     getSavedSearches);
router.post('/',    createSavedSearch);
router.delete('/:id', deleteSavedSearch);

module.exports = router;
