const express = require("express");
const { register, login, me } = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { registerValidator, loginValidator } = require("../middlewares/validators");
const { authLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter, registerValidator, validate, register);
router.post("/login",    authLimiter, loginValidator,    validate, login);
router.get("/me",        protect,                        me);

module.exports = router;