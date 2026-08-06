const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { register, login, me, updateAvatar, forgotPassword, resetPassword, logout, logoutAllSessions } = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator } = require("../middlewares/validators");
const { uploadAvatar } = require("../config/cloudinary");

const router = express.Router();

// El authLimiter de app.js ya limita por IP, pero eso no frena credential
// stuffing con IPs rotadas contra la MISMA cuenta. Este limita por email
// (normalizado por loginValidator antes de llegar acá) y solo cuenta los
// intentos fallidos — un usuario real puede loguearse todas las veces que
// quiera sin gastar su cupo. keyGenerator cae a la IP (con el helper que
// normaliza IPv6) solo si por algo no hay email, lo cual no debería pasar
// una vez que loginValidator ya lo exigió.
const accountLoginLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   Number(process.env.ACCOUNT_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  keyGenerator:          (req) => req.body?.email?.trim().toLowerCase() || ipKeyGenerator(req.ip),
  message:               { error: "Demasiados intentos para esta cuenta. Intenta de nuevo en 15 minutos." },
  standardHeaders:       true,
  legacyHeaders:         false,
  skip:                  (req) => process.env.NODE_ENV === "development",
});

router.post("/register",         registerValidator,         validate, register);
router.post("/login",            loginValidator,             validate, accountLoginLimiter, login);
router.post("/forgot-password",  forgotPasswordValidator,    validate, forgotPassword);
router.post("/reset-password",   resetPasswordValidator,     validate, resetPassword);
router.get("/me",        protect,                     me);
router.post("/logout",                                logout);
router.post("/logout-all", protect,                   logoutAllSessions);
router.post("/avatar",   protect, uploadAvatar.single("avatar"), updateAvatar);

module.exports = router;