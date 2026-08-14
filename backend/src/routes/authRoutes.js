const express   = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, me, updateMe, updateAvatar, forgotPassword, resetPassword, logout } = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, updateMeValidator } = require("../middlewares/validators");
const { uploadAvatar } = require("../config/cloudinary");

const router = express.Router();

// El authLimiter de app.js es por IP — como respaldo, si algún día el
// "trust proxy" no refleja la cadena real de proxies (ej. un header
// X-Forwarded-For que se pueda falsear), esto frena el fuerza bruta contra
// UNA cuenta puntual sin importar desde cuántas IPs venga. Solo cuenta
// intentos FALLIDOS (skipSuccessfulRequests) y usa el mismo mensaje
// genérico que el resto del login, así que no sirve para enumerar cuentas.
const loginPerAccountLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   5,
  message:               { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
  standardHeaders:       true,
  legacyHeaders:         false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.body?.email || "").trim().toLowerCase() || "unknown",
  skip: (req) => process.env.NODE_ENV === "development",
});

router.post("/register",         registerValidator,         validate, register);
router.post("/login",            loginPerAccountLimiter, loginValidator, validate, login);
router.post("/forgot-password",  forgotPasswordValidator,    validate, forgotPassword);
router.post("/reset-password",   resetPasswordValidator,     validate, resetPassword);
router.get("/me",        protect,                     me);
router.patch("/me",      protect, updateMeValidator, validate, updateMe);
router.post("/logout",                                logout);
router.post("/avatar",   protect, uploadAvatar.single("avatar"), updateAvatar);

module.exports = router;