const express = require('express');
const router = express.Router();
// 🔥 Asegúrate de que los nombres coincidan exactamente con lo que exportas
const { register, login } = require('../controllers/auth.controller'); 

router.post('/register', register);
router.post('/login', login);

module.exports = router;