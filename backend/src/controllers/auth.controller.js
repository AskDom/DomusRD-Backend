const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { generateSecret: generateTotpSecret, generate: generateTotpCode, verify: verifyTotpCode, generateURI: generateTotpURI } = require("otplib");
const QRCode = require("qrcode");
const { generateToken, generateTwoFactorToken, verifyToken } = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");

const VALID_ROLES = ["CLIENTE", "VENDEDOR", "AGENTE"];
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const TWO_FACTOR_ISSUER = "Domify";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Quita el password (y el secreto TOTP) antes de enviar al frontend
function sanitizeUser(user) {
  const { password, totpSecret, ...rest } = user;
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

    // El password ya es válido, pero si esta cuenta tiene 2FA activo la
    // sesión real no se abre todavía — el frontend debe pedir el código y
    // completar el login en POST /api/auth/2fa/verify con este tempToken.
    if (user.totpEnabled) {
      return res.json({ requiresTwoFactor: true, tempToken: generateTwoFactorToken(user) });
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
    console.error("❌ Error en updateAvatar:", error);
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
    console.error("❌ Error en forgotPassword:", error);
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
    console.error("❌ Error en resetPassword:", error);
    res.status(500).json({ error: "Error al restablecer la contraseña." });
  }
};

// 7. LOGOUT — limpia la cookie httpOnly del lado del servidor. La app móvil
// no la usa (solo borra el token de SecureStore en el cliente).
const logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Sesión cerrada." });
};

// 8. LOGIN — paso 2: confirma el código TOTP y recién ahí abre la sesión real
const verifyTwoFactor = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    let decoded;
    try {
      decoded = verifyToken(tempToken);
    } catch {
      return res.status(401).json({ error: "El token temporal es inválido o expiró. Inicia sesión de nuevo." });
    }
    if (!decoded.twoFactorPending) {
      return res.status(400).json({ error: "Token inválido para este paso." });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: "Esta cuenta no tiene 2FA activo." });
    }

    const result = await verifyTotpCode({ token: code, secret: user.totpSecret });
    if (!result.valid) {
      return res.status(401).json({ error: "Código incorrecto." });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({
      message: "Login exitoso",
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("❌ Error en verifyTwoFactor:", error);
    res.status(500).json({ error: "Error al verificar el código." });
  }
};

// 9. Genera un secreto TOTP nuevo y su QR — todavía no activa el 2FA, eso
// pasa en enableTwoFactor() una vez que el usuario prueba que lo escaneó bien.
const setupTwoFactor = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (user.totpEnabled) {
      return res.status(400).json({ error: "El 2FA ya está activo. Desactívalo antes de generar uno nuevo." });
    }

    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });

    const otpauthUrl = generateTotpURI({ issuer: TWO_FACTOR_ISSUER, label: user.email, secret });
    const qr = await QRCode.toDataURL(otpauthUrl);

    // "secret" se manda además del QR como respaldo para apps que solo
    // aceptan ingreso manual (no todas soportan escanear el QR).
    res.json({ qr, secret });
  } catch (error) {
    console.error("❌ Error en setupTwoFactor:", error);
    res.status(500).json({ error: "Error al iniciar la configuración de 2FA." });
  }
};

// 10. Confirma el código del paso anterior y recién ahí activa el 2FA
const enableTwoFactor = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user.totpSecret) {
      return res.status(400).json({ error: "Primero genera un código QR desde /api/auth/2fa/setup." });
    }

    const result = await verifyTotpCode({ token: code, secret: user.totpSecret });
    if (!result.valid) {
      return res.status(400).json({ error: "Código incorrecto." });
    }

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    res.json({ message: "2FA activado." });
  } catch (error) {
    console.error("❌ Error en enableTwoFactor:", error);
    res.status(500).json({ error: "Error al activar el 2FA." });
  }
};

// 11. Desactiva el 2FA — exige la contraseña actual para que una sesión
// abierta y desatendida no pueda apagarlo sin más.
const disableTwoFactor = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
    res.json({ message: "2FA desactivado." });
  } catch (error) {
    console.error("❌ Error en disableTwoFactor:", error);
    res.status(500).json({ error: "Error al desactivar el 2FA." });
  }
};

module.exports = {
  register, login, me, updateAvatar, forgotPassword, resetPassword, logout,
  verifyTwoFactor, setupTwoFactor, enableTwoFactor, disableTwoFactor,
};