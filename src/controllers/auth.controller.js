const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { generateToken } = require("../utils/jwt");

const VALID_ROLES = ["CLIENTE", "VENDEDOR", "AGENTE"];

// Quita el password antes de enviar el usuario al frontend
function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nombre, correo y contraseña son requeridos" });
    }

    const finalRole = VALID_ROLES.includes(role) ? role : "CLIENTE";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: finalRole },
    });

    const token = generateToken(user);

    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Correo y contraseña son requeridos" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const token = generateToken(user);

    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el usuario" });
  }
}

module.exports = { register, login, me };
