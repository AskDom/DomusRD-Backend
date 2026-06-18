const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// 1. REGISTRO DE USUARIOS (Modificado para responder lo que tu Frontend pide)
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

    // 1. Limpiamos el rol quitando espacios y pasándolo a mayúsculas
    let dbRole = role ? role.trim().toUpperCase() : 'CLIENTE';

    // 2. Control estricto para cumplir con tu schema.prisma en español
    if (dbRole === 'CLIENT') dbRole = 'CLIENTE';
    if (dbRole === 'SELLER') dbRole = 'VENDEDOR';
    if (dbRole === 'AGENT')  dbRole = 'AGENTE';

    console.log(`💾 Intentando guardar en PostgreSQL con rol: "${dbRole}"`);

    // 3. Crear el usuario en la base de datos
    const newUser = await prisma.user.create({
      data: {
        email: email.trim(),
        name: name.trim(),
        password: hashedPassword,
        role: dbRole 
      },
    });

    console.log("✅ Usuario creado con éxito en BD:", newUser.id);

    // 4. Generar el Token JWT inmediatamente para el Login Automático
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      process.env.JWT_SECRET || 'secret_fallback',
      { expiresIn: '8h' }
    );

    // 5. 🔥 AQUÍ ESTÁ EL TRUCO: Enviamos la estructura exacta que tu AuthContext.js busca
    return res.status(201).json({ 
      message: 'Usuario creado con éxito', 
      token, // <-- Tu Front lee esto en data.token
      user: { // <-- Tu Front lee esto en data.user
        id: newUser.id, 
        name: newUser.name, 
        email: newUser.email, 
        role: newUser.role 
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

module.exports = {
  register,
  login
};