const prisma = require('../config/prisma');
const logger = require('../config/logger');

const ALLOWED_FILTER_KEYS = ['search', 'city', 'type', 'status', 'rooms', 'minPrice', 'maxPrice'];

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
    logger.error('getSavedSearches', err);
    res.status(500).json({ error: 'Error al obtener las búsquedas guardadas.' });
  }
};

// POST /api/saved-searches — guarda una búsqueda con sus filtros actuales
const createSavedSearch = async (req, res) => {
  try {
    const { name, filters } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Ponle un nombre a la búsqueda.' });
    }
    const cleanFilters = pickFilters(filters);
    if (Object.keys(cleanFilters).length === 0) {
      return res.status(400).json({ error: 'La búsqueda no tiene ningún filtro que guardar.' });
    }

    const search = await prisma.savedSearch.create({
      data: { userId: req.user.userId, name: name.trim(), filters: cleanFilters },
    });
    res.status(201).json({ search });
  } catch (err) {
    logger.error('createSavedSearch', err);
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
    logger.error('deleteSavedSearch', err);
    res.status(500).json({ error: 'Error al eliminar la búsqueda.' });
  }
};

module.exports = { getSavedSearches, createSavedSearch, deleteSavedSearch };
