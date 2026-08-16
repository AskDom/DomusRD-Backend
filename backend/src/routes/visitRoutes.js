const express = require('express');
const router  = express.Router();
const { protect, requireRole } = require('../middlewares/auth.middleware');
const {
  createVisit, getMyVisits, getReceivedVisits, updateVisitStatus,
} = require('../controllers/visit.controller');

// Todas las rutas de visitas requieren sesión.
router.use(protect);

router.post('/',          createVisit);
router.get('/mine',       getMyVisits);
router.get('/received',   requireRole('VENDEDOR', 'AGENTE', 'ADMIN'), getReceivedVisits);
router.patch('/:id/status', updateVisitStatus);

module.exports = router;
