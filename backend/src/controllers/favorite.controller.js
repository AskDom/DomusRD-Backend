const prisma = require('../config/prisma');

// GET /api/favorites — obtiene todos los IDs favoritos del usuario autenticado
const getFavorites = async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.userId },
      select: { propertyId: true },
    });
    const ids = favorites.map((f) => f.propertyId);
    res.json({ favorites: ids });
  } catch (error) {
    console.error('❌ getFavorites:', error);
    res.status(500).json({ error: 'Error al obtener favoritos.' });
  }
};

// POST /api/favorites/:propertyId — agrega a favoritos
const addFavorite = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Chequeo explícito de existencia — sin esto, un UUID inventado caía en
    // un error de foreign key (500) en vez de un 404 limpio.
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada.' });

    const favorite = await prisma.favorite.create({
      data: { userId: req.user.userId, propertyId },
    });
    res.status(201).json({ favorite });
  } catch (error) {
    // @@unique([userId, propertyId]) — si ya existe, ignoramos silenciosamente
    if (error.code === 'P2002') {
      return res.status(200).json({ message: 'Ya estaba en favoritos.' });
    }
    console.error('❌ addFavorite:', error);
    res.status(500).json({ error: 'Error al agregar favorito.' });
  }
};

// DELETE /api/favorites/:propertyId — quita de favoritos
const removeFavorite = async (req, res) => {
  try {
    const { propertyId } = req.params;
    await prisma.favorite.deleteMany({
      where: { userId: req.user.userId, propertyId },
    });
    res.json({ message: 'Eliminado de favoritos.' });
  } catch (error) {
    console.error('❌ removeFavorite:', error);
    res.status(500).json({ error: 'Error al eliminar favorito.' });
  }
};

module.exports = { getFavorites, addFavorite, removeFavorite };