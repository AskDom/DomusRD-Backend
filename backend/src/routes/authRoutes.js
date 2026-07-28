const express = require("express");
const {
  register, login, me, updateAvatar,
  forgotPassword, resetPassword,
  verifyEmail, resendVerification,
} = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const {
  registerValidator, loginValidator,
  forgotPasswordValidator, resetPasswordValidator,
  verifyEmailValidator,
} = require("../middlewares/validators");
const { uploadAvatar } = require("../config/cloudinary");

const router = express.Router();

router.post("/register",         registerValidator,        validate, register);
router.post("/login",            loginValidator,            validate, login);
router.post("/forgot-password",  forgotPasswordValidator,   validate, forgotPassword);
router.post("/reset-password",   resetPasswordValidator,    validate, resetPassword);
router.post("/verify-email",     verifyEmailValidator,      validate, verifyEmail);
router.post("/resend-verification", protect,                resendVerification);
router.get("/me",        protect,                     me);
router.post("/avatar",   protect, uploadAvatar.single("avatar"), updateAvatar);

module.exports = router;
