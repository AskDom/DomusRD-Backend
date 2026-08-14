const prisma = require('../config/prisma');

// ── USUARIOS ─────────────────────────────────────────────────────────────────

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(search && { OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]}),
      ...(role && { role }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, avatar: true,
          role: true, createdAt: true,
          _count: { select: { properties: true, favorites: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getUsers:', err);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['CLIENTE', 'VENDEDOR', 'AGENTE', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    // Proteger: no puede quitarse a sí mismo el rol ADMIN
    if (req.params.id === req.user.userId && role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes cambiar tu propio rol de ADMIN.' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      // tokenVersion++ para que el rol nuevo aplique de inmediato — sin
      // esto, un JWT emitido con el rol viejo seguía siendo válido (y
      // "protect" lo aceptaba) hasta que expirara solo, hasta 7 días después.
      data: { role, tokenVersion: { increment: 1 } },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ user });
  } catch (err) {
    console.error('updateUserRole:', err);
    res.status(500).json({ error: 'Error al actualizar rol.' });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(403).json({ error: 'No puedes eliminar tu propia cuenta.' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Usuario eliminado.' });
  } catch (err) {
    console.error('deleteUser:', err);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
};

// ── PROPIEDADES ───────────────────────────────────────────────────────────────

// GET /api/admin/properties
const getAdminProperties = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', verified = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(search && { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { city:  { contains: search, mode: 'insensitive' } },
      ]}),
      ...(verified !== '' && { verified: verified === 'true' }),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          publishedBy: { select: { id: true, name: true, email: true, avatar: true } },
          _count: { select: { favorites: true } },
        },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({ properties, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getAdminProperties:', err);
    res.status(500).json({ error: 'Error al obtener propiedades.' });
  }
};

// PATCH /api/admin/properties/:id/verify
const verifyProperty = async (req, res) => {
  try {
    const { verified } = req.body;
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { verified: Boolean(verified) },
      select: { id: true, title: true, verified: true },
    });
    res.json({ property });
  } catch (err) {
    console.error('verifyProperty:', err);
    res.status(500).json({ error: 'Error al verificar propiedad.' });
  }
};

// DELETE /api/admin/properties/:id
const deleteAdminProperty = async (req, res) => {
  try {
    await prisma.property.delete({ where: { id: req.params.id } });
    res.json({ message: 'Propiedad eliminada.' });
  } catch (err) {
    console.error('deleteAdminProperty:', err);
    res.status(500).json({ error: 'Error al eliminar propiedad.' });
  }
};

// ── ESTADÍSTICAS ──────────────────────────────────────────────────────────────

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [
      totalUsers, totalProperties, pendingVerification,
      totalMessages, totalFavorites,
      usersByRole, propertiesByType,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.property.count({ where: { verified: false } }),
      prisma.message.count(),
      prisma.favorite.count(),
      prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      prisma.property.groupBy({ by: ['type'], _count: { id: true } }),
    ]);

    res.json({
      totalUsers, totalProperties, pendingVerification,
      totalMessages, totalFavorites,
      usersByRole:       usersByRole.map(r => ({ role: r.role, count: r._count.id })),
      propertiesByType:  propertiesByType.map(t => ({ type: t.type, count: t._count.id })),
    });
  } catch (err) {
    console.error('getStats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
};

module.exports = { getUsers, updateUserRole, deleteUser, getAdminProperties, verifyProperty, deleteAdminProperty, getStats };