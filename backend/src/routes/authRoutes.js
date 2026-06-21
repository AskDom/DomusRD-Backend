const express = require("express");
const path = require("path");
const { register, login, me } = require(path.join(__dirname, "..", "controllers", "auth.controller.js"));
const { requireAuth } = require(path.join(__dirname, "..", "middleware", "auth.middleware.js"));

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

module.exports = router;