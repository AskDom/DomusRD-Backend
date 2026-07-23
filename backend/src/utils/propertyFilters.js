// Construye el `where` de Prisma para filtrar propiedades a partir de un
// objeto de filtros plano (search, city, type, status, rooms, minPrice,
// maxPrice). Se usa tanto en GET /api/properties como al comparar una
// propiedad recién publicada contra las búsquedas guardadas de otros
// usuarios — así ambos lados garantizan exactamente el mismo criterio.
function buildPropertyWhere(filters = {}) {
  const { search, city, type, status, rooms, minPrice, maxPrice } = filters;
  const where = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { city:  { contains: search, mode: 'insensitive' } },
    ];
  }

  if (city)     where.city   = { contains: city, mode: 'insensitive' };
  if (type)     where.type   = String(type).toUpperCase();
  if (status)   where.status = String(status).toUpperCase();
  if (rooms)    where.rooms  = { gte: parseInt(rooms) };
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  return where;
}

module.exports = { buildPropertyWhere };
