const express    = require('express');
const router     = express.Router();
const { protect } = require('../middlewares/auth.middleware');

const messageController = require('../controllers/message.controller');
const { getMessages, sendMessage, markAsRead, deleteMessage } = messageController;

if (!getMessages || !sendMessage || !markAsRead || !deleteMessage) {
  console.error('❌ messageController exports:', Object.keys(messageController));
  throw new Error('message.controller.js no exporta las funciones correctas');
}

router.use(protect);
router.get('/',            getMessages);
router.post('/',           sendMessage);
router.patch('/:id/read',  markAsRead);
router.delete('/:id',      deleteMessage);

module.exports = router;