const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerPushToken,
  unregisterPushToken,
} = require('../controllers/notification.controller');

router.use(protect);

router.get('/',              getNotifications);
router.patch('/read-all',    markAllAsRead);
router.patch('/:id/read',    markAsRead);
router.post('/push-token',   registerPushToken);
router.delete('/push-token', unregisterPushToken);

module.exports = router;
