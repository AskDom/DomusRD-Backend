// Parsea el query param `bbox` de GET /api/properties: "lat1,lng1,lat2,lng2"
// (las dos esquinas del viewport del mapa, en cualquier orden — por eso se
// normalizan con min/max). Devuelve null si falta o viene mal formado, para
// que el filtro simplemente no se aplique en vez de tirar un 400 por un
// bbox mal armado desde el cliente.
function parseBbox(bbox) {
  if (!bbox) return null;
  const parts = String(bbox).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;

  const [lat1, lng1, lat2, lng2] = parts;
  return {
    minLat: Math.min(lat1, lat2),
    maxLat: Math.max(lat1, lat2),
    minLng: Math.min(lng1, lng2),
    maxLng: Math.max(lng1, lng2),
  };
}

// Construye el `where` de Prisma para filtrar propiedades a partir de un
// objeto de filtros plano (search, city, type, status, rooms, minPrice,
// maxPrice, bbox). Se usa tanto en GET /api/properties como al comparar una
// propiedad recién publicada contra las búsquedas guardadas de otros
// usuarios — así ambos lados garantizan exactamente el mismo criterio.
function buildPropertyWhere(filters = {}) {
  const { search, city, type, status, rooms, minPrice, maxPrice, bbox, ids, publishedBy } = filters;
  const where = {};

  // Favoritos ("?ids=a,b,c") — la app pedía un request por cada favorito;
  // ahora trae todos los que coinciden en uno solo. No se pagina (la lista
  // de favoritos es corta y no tiene paginación en la UI).
  if (ids && ids.length) where.id = { in: ids };
  // "?publishedBy=<userId>" — "mis propiedades" en el perfil. Antes la app
  // traía la primera página (50) y filtraba en el cliente, perdiéndose todo
  // lo que quedaba más allá de la primera página.
  if (publishedBy) where.publishedById = publishedBy;

  if (search) {
    where.OR = [
      { title:  { contains: search, mode: 'insensitive' } },
      { city:   { contains: search, mode: 'insensitive' } },
      { sector: { contains: search, mode: 'insensitive' } },
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
  // Filtra por el viewport del mapa en vez de traer todo y recortar en el
  // cliente — con el índice @@index([lat, lng]) esto no hace Seq Scan
  // aunque el catálogo crezca (ver prueba de carga del 2026-08-10).
  if (bbox) {
    where.lat = { gte: bbox.minLat, lte: bbox.maxLat };
    where.lng = { gte: bbox.minLng, lte: bbox.maxLng };
  }

  return where;
}

module.exports = { buildPropertyWhere, parseBbox };
