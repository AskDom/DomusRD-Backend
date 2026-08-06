module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  // otplib (2FA) depende de @scure/base, que es ESM-only y por defecto Jest
  // no transforma nada dentro de node_modules — sin esto, requerir otplib
  // revienta con "Unexpected token 'export'". Ver babel.config.js.
  transformIgnorePatterns: ["/node_modules/(?!(otplib|@otplib|@scure|@noble)/)"],
};
