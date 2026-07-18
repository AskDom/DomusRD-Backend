const express = require('express');
const router  = express.Router();
const { getMessages, sendMessage, markAsRead, deleteMessage } = require('../controllers/message.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { sendMessageValidator } = require('../middlewares/validators');

router.use(protect);

router.get('/',             getMessages);
router.post('/',            sendMessageValidator, validate, sendMessage);
router.patch('/:id/read',   markAsRead);
router.delete('/:id',       deleteMessage);

module.exports = router;