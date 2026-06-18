const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Mapa de TODOS los valores posibles que puede enviar el frontend → valor del enum de Prisma
const ROLE_MAP = {
  // En español con mayúscula inicial (lo que envía el AuthModal: "Cliente", "Vendedor", "Agente")
  'Cliente':  'CLIENTE',
  'Vendedor': 'VENDEDOR',
  'Agente':   'AGENTE',
  // En español todo minúsculas
  'cliente':  'CLIENTE',
  'vendedor': 'VENDEDOR',
  'agente':   'AGENTE',
  // Ya en mayúsculas
  'CLIENTE':  'CLIENTE',
  'VENDEDOR': 'VENDEDOR',
  'AGENTE':   'AGENTE',
  // En inglés (por compatibilidad)
  'client':   'CLIENTE',
  'seller':   'VENDEDOR',
  'agent':    'AGENTE',
  'CLIENT':   'CLIENTE',
  'SELLER':   'VENDEDOR',
  'AGENT':    'AGENTE',
};

// 1. REGISTRO DE USUARIOS
const register = async (req, res) => {
  try {
    console.log("🚀 DATOS RECIBIDOS EN EL BODY:", req.body);
    const { email, password, name, role } = req.body;

    // Verificar si el correo ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mapeo robusto del rol — acepta cualquier formato del frontend
    const dbRole = ROLE_MAP[role?.trim()] || 'CLIENTE';
    console.log(`💾 Rol recibido: "${role}" → guardando como: "${dbRole}"`);

    // Crear el usuario en la base de datos
    const newUser = await prisma.user.create({
      data: {
        email: email.trim(),
        name: name.trim(),
        password: hashedPassword,
        role: dbRole,
      },
    });

    console.log("✅ Usuario creado con éxito en BD:", newUser.id, "| Rol:", newUser.role);

    // Generar Token JWT para Login Automático
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      process.env.JWT_SECRET || 'secret_fallback',
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      message: 'Usuario creado con éxito',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      }
    });

  } catch (error) {
    console.error("❌ ERROR INTERNO EN EL REGISTRO:", error);
    return res.status(500).json({ error: 'Error en el servidor al registrar usuario.' });
  }
};

// 2. LOGIN DE USUARIOS
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Credenciales incorrectas.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret_fallback',
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("❌ ERROR INTERNO EN EL LOGIN:", error);
    return res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
  }
};

module.exports = { register, login };