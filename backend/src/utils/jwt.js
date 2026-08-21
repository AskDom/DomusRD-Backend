const jwt = require("jsonwebtoken");

function generateToken(user) {
  return jwt.sign(
    // "tv" (tokenVersion) es lo que permite revocar este token antes de que
    // expire por su cuenta — ver protect() en auth.middleware.js.
    { id: user.id, role: user.role, tv: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d", algorithm: "HS256" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
}

module.exports = { generateToken, verifyToken };