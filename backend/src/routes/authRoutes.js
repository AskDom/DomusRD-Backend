const express = require("express");
const { register, login, me } = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { registerValidator, loginValidator } = require("../middlewares/validators");

const router = express.Router();

router.post("/register", registerValidator, validate, register);
router.post("/login",    loginValidator,    validate, login);
router.get("/me",        protect,                     me);

module.exports = router;