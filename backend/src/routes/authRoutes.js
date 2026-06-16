const express = require('express');
const path = require('path');

// Importamos la lógica desde el controlador correcto
const { register, login } = require(path.join(__dirname, '..', 'controllers', 'auth.controller.js'));

const router = express.Router();

// Definimos los endpoints
router.post('/register', register);
router.post('/login', login);

// Exportamos el Router (Esto es lo que Express necesita en server.js)
module.exports = router;