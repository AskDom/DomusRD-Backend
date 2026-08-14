const prisma = require('../config/prisma');
const { stripHtmlTags } = require('../utils/sanitizeText');

const ALLOWED_FILTER_KEYS = ['search', 'city', 'type', 'status', 'rooms', 'minPrice', 'maxPrice'];

// Sin este tope, un usuario podía crear búsquedas guardadas sin límite, y
// cada propiedad publicada compara contra TODAS las búsquedas guardadas que
// existan (ver savedSearchNotifier.js) — más búsquedas de las que cualquier
// usuario real necesita solo encarecen esa comparación para todo el mundo.
const MAX_SAVED_SEARCHES_PER_USER = 20;

function pickFilters(input = {}) {
  const filters = {};
  for (const key of ALLOWED_FILTER_KEYS) {
    if (input[key] !== undefined && input[key] !== '') filters[key] = input[key];
  }
  return filters;
}

// GET /api/saved-searches — búsquedas guardadas del usuario autenticado
const getSavedSearches = async (req, res) => {
  try {
    const searches = await prisma.savedSearch.findMany({
      where:   { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ searches });
  } catch (err) {
    console.error('getSavedSearches:', err);
    res.status(500).json({ error: 'Error al obtener las búsquedas guardadas.' });
  }
};

// POST /api/saved-searches — guarda una búsqueda con sus filtros actuales
const createSavedSearch = async (req, res) => {
  try {
    // createSavedSearchValidator ya garantiza que req.body.name es un string
    // no vacío — acá solo falta la limpieza de HTML, no la validación de tipo.
    const name = stripHtmlTags(req.body.name);
    const { filters } = req.body;
    const cleanFilters = pickFilters(filters);
    if (Object.keys(cleanFilters).length === 0) {
      return res.status(400).json({ error: 'La búsqueda no tiene ningún filtro que guardar.' });
    }

    // count() + create() en una transacción con advisory lock por usuario:
    // sin esto, dos requests en paralelo del mismo usuario podían leer el
    // mismo count por debajo del límite y crear las dos, saltándose el tope
    // (TOCTOU) — el lock serializa cualquier creación concurrente de ESE
    // usuario puntual, sin bloquear a los demás.
    const search = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.user.userId}))`;

      const existingCount = await tx.savedSearch.count({ where: { userId: req.user.userId } });
      if (existingCount >= MAX_SAVED_SEARCHES_PER_USER) {
        const limitError = new Error('LIMIT_REACHED');
        limitError.code = 'LIMIT_REACHED';
        throw limitError;
      }

      return tx.savedSearch.create({
        data: { userId: req.user.userId, name: name.trim(), filters: cleanFilters },
      });
    });

    res.status(201).json({ search });
  } catch (err) {
    if (err.code === 'LIMIT_REACHED') {
      return res.status(403).json({
        error: `Alcanzaste el límite de ${MAX_SAVED_SEARCHES_PER_USER} búsquedas guardadas. Elimina una para guardar otra.`
      });
    }
    console.error('createSavedSearch:', err);
    res.status(500).json({ error: 'Error al guardar la búsqueda.' });
  }
};

// DELETE /api/saved-searches/:id — solo el dueño puede borrarla
const deleteSavedSearch = async (req, res) => {
  try {
    const { count } = await prisma.savedSearch.deleteMany({
      where: { id: req.params.id, userId: req.user.userId },
    });
    if (count === 0) {
      return res.status(404).json({ error: 'Búsqueda no encontrada.' });
    }
    res.json({ message: 'Búsqueda eliminada.' });
  } catch (err) {
    console.error('deleteSavedSearch:', err);
    res.status(500).json({ error: 'Error al eliminar la búsqueda.' });
  }
};

module.exports = { getSavedSearches, createSavedSearch, deleteSavedSearch };
