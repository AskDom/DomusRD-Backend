const express = require('express');
const router  = express.Router();
const { attachUserIfPresent } = require('../middlewares/auth.middleware');
const { getPublicProfile } = require('../controllers/user.controller');

// Pública — cualquiera puede ver el perfil de un vendedor/agente, pero
// attachUserIfPresent deja saber al controller si hay sesión, para aplicar
// el mismo criterio de ubicación aproximada que /api/properties.
router.get('/:id', attachUserIfPresent, getPublicProfile);

module.exports = router;
