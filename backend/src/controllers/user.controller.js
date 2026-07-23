const prisma = require('../config/prisma');

// GET /api/users/:id — perfil público de un vendedor/agente:
// datos básicos, ranking (promedio de reseñas de sus propiedades) y sus publicaciones
const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where:  { id },
      select: { id: true, name: true, avatar: true, role: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const [properties, ratingAgg] = await Promise.all([
      prisma.property.findMany({
        where:   { publishedById: id },
        orderBy: { createdAt: 'desc' },
        include: {
          publishedBy: { select: { id: true, name: true, email: true, avatar: true } },
          _count:      { select: { favorites: true } },
        },
      }),
      prisma.review.aggregate({
        where: { property: { publishedById: id } },
        _avg:   { rating: true },
        _count: { rating: true },
      }),
    ]);

    res.json({
      user,
      stats: {
        propertiesCount: properties.length,
        avgRating:       ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
        reviewsCount:     ratingAgg._count.rating,
      },
      properties,
    });
  } catch (err) {
    console.error('getPublicProfile:', err);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
};

module.exports = { getPublicProfile };
