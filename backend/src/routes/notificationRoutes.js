const express = require('express');
const router  = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notification.controller');

router.use(protect);

router.get('/',            getNotifications);
router.patch('/read-all',  markAllAsRead);
router.patch('/:id/read',  markAsRead);

module.exports = router;
