const express = require('express');
const router  = express.Router();
const { getPublicProfile } = require('../controllers/user.controller');

// Pública — cualquiera puede ver el perfil de un vendedor/agente
router.get('/:id', getPublicProfile);

module.exports = router;
