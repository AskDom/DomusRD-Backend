const prisma = require('../config/prisma');

const USER_SELECT = { select: { id: true, name: true } };

// GET /api/reviews/:propertyId — obtiene todas las reseñas de una propiedad
const getReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const reviews = await prisma.review.findMany({
      where:   { propertyId },
      include: { user: USER_SELECT },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular promedio
    const avg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({ reviews, average: Math.round(avg * 10) / 10, total: reviews.length });
  } catch (err) {
    console.error('getReviews:', err);
    res.status(500).json({ error: 'Error al obtener reseñas.' });
  }
};

// POST /api/reviews/:propertyId — crea o actualiza la reseña del usuario
const upsertReview = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5.' });
    }
    if (!comment?.trim()) {
      return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
    }

    // No puede reseñar su propia propiedad
    const property = await prisma.property.findUnique({
      where: { id: propertyId }, select: { publishedById: true },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada.' });
    if (property.publishedById === userId) {
      return res.status(403).json({ error: 'No puedes reseñar tu propia propiedad.' });
    }

    const review = await prisma.review.upsert({
      where:  { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId, rating: Number(rating), comment: comment.trim() },
      update: { rating: Number(rating), comment: comment.trim() },
      include: { user: USER_SELECT },
    });

    res.status(200).json({ review });
  } catch (err) {
    console.error('upsertReview:', err);
    res.status(500).json({ error: 'Error al guardar la reseña.' });
  }
};

// DELETE /api/reviews/:propertyId — elimina la reseña del usuario
const deleteReview = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.userId;

    await prisma.review.deleteMany({ where: { userId, propertyId } });
    res.json({ message: 'Reseña eliminada.' });
  } catch (err) {
    console.error('deleteReview:', err);
    res.status(500).json({ error: 'Error al eliminar la reseña.' });
  }
};

module.exports = { getReviews, upsertReview, deleteReview };