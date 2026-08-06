const express = require("express");
const {
  register, login, me, updateAvatar, forgotPassword, resetPassword, logout,
  verifyTwoFactor, setupTwoFactor, enableTwoFactor, disableTwoFactor,
} = require("../controllers/auth.controller");
const { protect, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const {
  registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator,
  twoFactorVerifyValidator, twoFactorCodeValidator, twoFactorDisableValidator,
} = require("../middlewares/validators");
const { uploadAvatar } = require("../config/cloudinary");

const router = express.Router();

router.post("/register",         registerValidator,         validate, register);
router.post("/login",            loginValidator,             validate, login);
router.post("/forgot-password",  forgotPasswordValidator,    validate, forgotPassword);
router.post("/reset-password",   resetPasswordValidator,     validate, resetPassword);
router.get("/me",        protect,                     me);
router.post("/logout",                                logout);
router.post("/avatar",   protect, uploadAvatar.single("avatar"), updateAvatar);

// 2FA — setup/enable/disable son solo para ADMIN (ver checklist de seguridad);
// verify es el segundo paso del login, así que no requiere sesión todavía.
router.post("/2fa/verify",   twoFactorVerifyValidator, validate, verifyTwoFactor);
router.post("/2fa/setup",    protect, requireRole("ADMIN"), setupTwoFactor);
router.post("/2fa/enable",   protect, requireRole("ADMIN"), twoFactorCodeValidator, validate, enableTwoFactor);
router.post("/2fa/disable",  protect, requireRole("ADMIN"), twoFactorDisableValidator, validate, disableTwoFactor);

module.exports = router;