const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { generateToken } = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");
const logger = require("../config/logger");

const VALID_ROLES = ["CLIENTE", "VENDEDOR", "AGENTE"];
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

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
    const finalRole = VALID_ROLES.includes(role?.toUpperCase()) ? role.toUpperCase() : "CLIENTE";

    const newUser = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: finalRole }
    });

    const token = generateToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({
      message: "Usuario creado con éxito",
      user: sanitizeUser(newUser),
      // El frontend web ya no debe guardar esto — la sesión real vive en la
      // cookie httpOnly seteada arriba. Se sigue mandando por compatibilidad
      // con la app móvil, que no maneja cookies y lo guarda en SecureStore.
      token
    });
  } catch (error) {
    logger.error("Error en register", error);
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
    setAuthCookie(res, token);

    res.json({
      message: "Login exitoso",
      user: sanitizeUser(user),
      // Ídem que en register(): queda solo para la app móvil.
      token
    });
  } catch (error) {
    logger.error("Error en login", error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
};

// 3. GET USUARIO ACTUAL (para mantener sesión al recargar)
const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    logger.error("Error en me", error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

// 4. ACTUALIZAR FOTO DE PERFIL
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ninguna imagen." });
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data:  { avatar: req.file.path },
    });

    res.json({ message: "Foto de perfil actualizada.", user: sanitizeUser(user) });
  } catch (error) {
    logger.error("Error en updateAvatar", error);
    res.status(500).json({ error: "Error al actualizar la foto de perfil." });
  }
};

// 5. SOLICITAR RECUPERACIÓN DE CONTRASEÑA
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Siempre respondemos lo mismo, exista o no el correo — evita que alguien
    // use este endpoint para averiguar qué correos están registrados.
    if (user) {
      const rawToken         = crypto.randomBytes(32).toString("hex");
      const resetToken       = hashToken(rawToken);
      const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.user.update({
        where: { id: user.id },
        data:  { resetToken, resetTokenExpiry },
      });

      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    res.json({ message: "Si existe una cuenta con ese correo, te enviamos un enlace para recuperar tu contraseña." });
  } catch (error) {
    logger.error("Error en forgotPassword", error);
    res.status(500).json({ error: "Error al procesar la solicitud." });
  }
};

// 6. RESTABLECER CONTRASEÑA CON EL TOKEN DEL CORREO
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken:       hashToken(token),
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "El enlace es inválido o ya expiró." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data:  { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: "Contraseña actualizada con éxito." });
  } catch (error) {
    logger.error("Error en resetPassword", error);
    res.status(500).json({ error: "Error al restablecer la contraseña." });
  }
};

// 7. LOGOUT — limpia la cookie httpOnly del lado del servidor. La app móvil
// no la usa (solo borra el token de SecureStore en el cliente).
const logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Sesión cerrada." });
};

module.exports = { register, login, me, updateAvatar, forgotPassword, resetPassword, logout };