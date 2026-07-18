const { validationResult } = require('express-validator');

// Middleware que revisa los errores de validación y los retorna como 400
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Datos inválidos",
      fields: errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { validate };