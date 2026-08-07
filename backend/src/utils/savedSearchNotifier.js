const prisma = require('../config/prisma');
const { buildPropertyWhere } = require('./propertyFilters');
const logger = require('../config/logger');

// Se llama justo después de crear una propiedad nueva. Compara esa propiedad
// contra los filtros de TODAS las búsquedas guardadas (reusando el mismo
// buildPropertyWhere que usa el buscador, para garantizar el mismo criterio),
// crea una notificación por cada coincidencia y la empuja en tiempo real por
// el socket del usuario dueño de esa búsqueda (mismo patrón que los mensajes).
async function notifyMatchingSavedSearches(property, io) {
  try {
    const searches = await prisma.savedSearch.findMany();
    if (!searches.length) return;

    const matches = [];
    for (const search of searches) {
      // No tiene sentido notificarle a alguien su propia publicación
      if (search.userId === property.publishedById) continue;

      const where = buildPropertyWhere(search.filters || {});
      const count = await prisma.property.count({ where: { ...where, id: property.id } });
      if (count > 0) matches.push(search);
    }

    if (!matches.length) return;

    await prisma.notification.createMany({
      data: matches.map((s) => ({
        userId:     s.userId,
        message:    `Nueva propiedad que coincide con "${s.name}": ${property.title}`,
        propertyId: property.id,
      })),
    });

    if (io) {
      for (const s of matches) {
        io.to(`user:${s.userId}`).emit('new_notification', {
          message:    `Nueva propiedad que coincide con "${s.name}": ${property.title}`,
          propertyId: property.id,
          createdAt:  new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    // Nunca debe romper la publicación de la propiedad por un fallo acá
    logger.error('notifyMatchingSavedSearches', err);
  }
}

module.exports = { notifyMatchingSavedSearches };
