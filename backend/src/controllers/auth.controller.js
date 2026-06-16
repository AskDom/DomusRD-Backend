const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// 1. REGISTRO DE USUARIOS
const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario en la base de datos
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        // Si mandan un rol, lo pasa a minúsculas. Si no, no envía nada para que Postgres use el default
        ...(role ? { role: role.toLowerCase() } : {})
      },
    });

    res.status(201).json({ message: 'Usuario creado con éxito', userId: newUser.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor al registrar usuario.' });
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

    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
  }
};

module.exports = {
  register,
  login
};
