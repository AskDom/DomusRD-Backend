const jwt = require("jsonwebtoken");

const TWO_FACTOR_TOKEN_EXPIRES_IN = "5m";

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d", algorithm: "HS256" }
  );
}

// Token de vida corta que solo certifica que el password ya fue verificado
// — no es una sesión: no lleva email/role y auth.middleware.js lo rechaza
// explícitamente si se usa como si fuera un token normal (ver twoFactorPending).
function generateTwoFactorToken(user) {
  return jwt.sign(
    { id: user.id, twoFactorPending: true },
    process.env.JWT_SECRET,
    { expiresIn: TWO_FACTOR_TOKEN_EXPIRES_IN, algorithm: "HS256" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
}

module.exports = { generateToken, generateTwoFactorToken, verifyToken };