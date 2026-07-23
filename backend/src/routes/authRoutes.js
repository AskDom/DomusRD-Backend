const express = require("express");
const { register, login, me, updateAvatar } = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { registerValidator, loginValidator } = require("../middlewares/validators");
const { uploadAvatar } = require("../config/cloudinary");

const router = express.Router();

router.post("/register", registerValidator, validate, register);
router.post("/login",    loginValidator,    validate, login);
router.get("/me",        protect,                     me);
router.post("/avatar",   protect, uploadAvatar.single("avatar"), updateAvatar);

module.exports = router;