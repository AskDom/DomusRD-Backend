const express = require('express');
const router  = express.Router();
const { protect, requireRole } = require('../middlewares/auth.middleware');
const {
  getUsers, updateUserRole, verifyUser, deleteUser,
  getAdminProperties, verifyProperty, deleteAdminProperty,
  getStats,
} = require('../controllers/admin.controller');

// Todas las rutas del panel requieren estar autenticado y ser ADMIN
router.use(protect);
router.use(requireRole('ADMIN'));

// Estadísticas
router.get('/stats', getStats);

// Usuarios
router.get('/users',             getUsers);
router.patch('/users/:id/role',  updateUserRole);
router.patch('/users/:id/verify', verifyUser);
router.delete('/users/:id',      deleteUser);

// Propiedades
router.get('/properties',                 getAdminProperties);
router.patch('/properties/:id/verify',    verifyProperty);
router.delete('/properties/:id',          deleteAdminProperty);

module.exports = router;