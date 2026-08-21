const express     = require('express');
const rateLimit   = require('express-rate-limit');
const router  = express.Router();
const { getMessages, sendMessage, markAsRead, markConversationRead, deleteMessage } = require('../controllers/message.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { sendMessageValidator } = require('../middlewares/validators');

router.use(protect);

// El apiLimiter general (app.js) es por IP y se comparte con el resto de la
// API — acá va uno propio por usuario, así que varios usuarios detrás de la
// misma IP (oficina, NAT) no se pisan, y un usuario no puede saturar de
// mensajes a otro sin importar desde cuántas IPs escriba.
const sendMessageLimiter = rateLimit({
  windowMs:        5 * 60 * 1000,
  max:              30,
  message:          { error: "Demasiados mensajes. Esperá unos minutos antes de seguir." },
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => req.user.userId,
  skip: (req) => process.env.NODE_ENV === "test",
});

router.get('/',             getMessages);
router.post('/',            sendMessageLimiter, sendMessageValidator, validate, sendMessage);
router.patch('/read-all',   markConversationRead);
router.patch('/:id/read',   markAsRead);
router.delete('/:id',       deleteMessage);

module.exports = router;