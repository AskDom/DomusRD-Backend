const prisma = require('../config/prisma');
const { buildPropertyWhere } = require('./propertyFilters');

// Queries de búsqueda en vuelo por propiedad nueva. Antes era Promise.all
// sobre TODAS las búsquedas guardadas del sistema sin tope de concurrencia.
const CONCURRENCY = 5;

// Se llama justo después de crear una propiedad nueva. Compara esa propiedad
// contra los filtros de TODAS las búsquedas guardadas (reusando el mismo
// buildPropertyWhere que usa el buscador, para garantizar el mismo criterio),
// crea una notificación por cada coincidencia y la empuja en tiempo real por
// el socket del usuario dueño de esa búsqueda (mismo patrón que los mensajes).
async function notifyMatchingSavedSearches(property, io) {
  try {
    // No tiene sentido notificarle a alguien su propia publicación — filtrar
    // esto en la misma query evita traer y descartar filas de más.
    const searches = await prisma.savedSearch.findMany({
      where: { userId: { not: property.publishedById } },
    });
    if (!searches.length) return;

    // Una consulta por búsqueda es inevitable (cada una tiene sus propios
    // filtros), pero no hay razón para hacerlas en serie — el límite de
    // MAX_SAVED_SEARCHES_PER_USER búsquedas por usuario (ver
    // savedSearch.controller.js) mantiene esto acotado.
    //
    // PERO tampoco hay que lanzarlas todas en paralelo de un golpe: el
    // fan-out total es búsquedas × propiedad nueva, y una sola propiedad
    // podía disparar miles de queries simultáneas a la base (DoS
    // amplificable). Las procesamos por bloques de CONCURRENCY, que limita
    // las queries en vuelo sin hacer la espera totalmente serial.
    const results = [];
    for (let i = 0; i < searches.length; i += CONCURRENCY) {
      const chunk = searches.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (search) => {
          const where = buildPropertyWhere(search.filters || {});
          const count = await prisma.property.count({ where: { ...where, id: property.id } });
          return count > 0 ? search : null;
        })
      );
      results.push(...chunkResults);
    }
    const matches = results.filter(Boolean);

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
    console.error('❌ notifyMatchingSavedSearches:', err);
  }
}

module.exports = { notifyMatchingSavedSearches };
