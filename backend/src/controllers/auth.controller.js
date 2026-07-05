const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");

const VALID_ROLES = ["CLIENTE", "VENDEDOR", "AGENTE"];

// Quita el password antes de enviar al frontend
function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// 1. REGISTRO DE USUARIOS
const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nombre, correo y contraseña son requeridos" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "El correo ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const finalRole = VALID_ROLES.includes(role) ? role : "CLIENTE";

    const newUser = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: finalRole }
    });

    const token = generateToken(newUser);

    res.status(201).json({
      message: "Usuario creado con éxito",
      user: sanitizeUser(newUser),
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

// 2. LOGIN DE USUARIOS
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Correo y contraseña son requeridos" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = generateToken(user);

    res.json({
      message: "Login exitoso",
      user: sanitizeUser(user),
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
};

// 3. GET USUARIO ACTUAL (para mantener sesión al recargar)
const me = async (req, res) => {
  try {
    console.log('🔍 me() - req.user:', req.user);
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

module.exports = { register, login, me };