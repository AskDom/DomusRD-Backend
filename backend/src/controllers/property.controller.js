const prisma = require('../config/prisma');
const { isOwner } = require('../middlewares/auth.middleware');
const { buildPropertyWhere, parseBbox } = require('../utils/propertyFilters');
const { notifyMatchingSavedSearches } = require('../utils/savedSearchNotifier');
const { stripHtmlTags } = require('../utils/sanitizeText');
const { roundToZone } = require('../utils/geo');

// Fragmento reutilizable para el autor de una propiedad — el `verified` del
// usuario alimenta el sello "agente verificado" en tarjetas y detalle.
const PUBLISHER_SELECT = { select: { id: true, name: true, avatar: true, verified: true } };

// Solo enlaces http(s) — nada de javascript:, data: ni protocolos raros
// colados en el body para un iframe (XSS clásico con src "javascript:...").
const isSafeHttpUrl = (value) => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Mismo límite que el frontend (Publish.jsx) para los planes con tope. Se
// repite aquí porque el frontend solo deshabilita el botón — sin este
// chequeo, cualquiera podía publicar sin límite llamando al endpoint
// directamente. AGENTE también está topado (antes no tenía límite, y un
// atacante podía crear propiedades sin tope para amplificar el fan-out de
// saved searches).
const ROLE_PROPERTY_LIMITS = {
  VENDEDOR: 3,
  AGENTE:   10,
};

// 1. CREAR UNA PROPIEDAD
const createProperty = async (req, res) => {
  try {
    const {
      description, price, currency, city, sector,
      lat, lng, rooms, baths, parking, type, status, images,
      videoUrl, virtualTourUrl,
    } = req.body;
    const title = stripHtmlTags(req.body.title);

    // El dueño de la propiedad es siempre el usuario autenticado (del token),
    // nunca un valor que venga del body — evita que alguien publique a nombre de otro.
    const userId = req.user.userId;

    if (!title || !price || !city || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Título, precio, ciudad, lat y lng son obligatorios.'
      });
    }

    if (!isSafeHttpUrl(videoUrl) || !isSafeHttpUrl(virtualTourUrl)) {
      return res.status(400).json({ error: 'Los enlaces de video/tour deben ser URLs válidas.' });
    }

    const propertyData = {
      data: {
        title,
        description: stripHtmlTags(description) || '',
        price: parseFloat(price),
        currency: currency || 'USD',
        city,
        sector: sector || null,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        rooms: parseInt(rooms) || 1,
        baths: parseInt(baths) || 1,
        parking: parseInt(parking) || 0,
        type: type || 'APARTAMENTO',
        status: status || 'VENTA',
        images: images || [],
        videoUrl: videoUrl || null,
        virtualTourUrl: virtualTourUrl || null,
        publishedBy: {
          connect: { id: userId }
        }
      },
      include: {
        publishedBy: PUBLISHER_SELECT
      }
    };

    let newProperty;
    const roleLimit = ROLE_PROPERTY_LIMITS[req.user.role];
    if (roleLimit !== undefined) {
      // count() + create() en una transacción con advisory lock por usuario
      // (mismo patrón que createSavedSearch): sin esto, dos publicaciones en
      // paralelo del mismo Vendedor podían leer el mismo count por debajo
      // del límite y crear las dos, saltándose el tope (TOCTOU).
      newProperty = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

        const publishedCount = await tx.property.count({ where: { publishedById: userId } });
        if (publishedCount >= roleLimit) {
          const limitError = new Error('LIMIT_REACHED');
          limitError.code = 'LIMIT_REACHED';
          throw limitError;
        }

        return tx.property.create(propertyData);
      });
    } else {
      newProperty = await prisma.property.create(propertyData);
    }

    console.log('✅ Propiedad creada:', newProperty.id);
    res.status(201).json({ message: 'Propiedad publicada con éxito', property: newProperty });

    // No bloquea la respuesta — la comparación contra búsquedas guardadas
    // corre en segundo plano después de responderle al que publicó.
    notifyMatchingSavedSearches(newProperty, req.app.get('io'));
  } catch (error) {
    if (error.code === 'LIMIT_REACHED') {
      return res.status(403).json({
        error: `Alcanzaste el límite de ${ROLE_PROPERTY_LIMITS[req.user?.role] || 'tu plan'} propiedades publicadas para tu plan.`
      });
    }
    console.error('❌ Error en createProperty:', error);
    res.status(500).json({ error: 'Error en el servidor al crear la propiedad.' });
  }
};

// 2. OBTENER TODAS LAS PROPIEDADES (Con filtro)
const getProperties = async (req, res) => {
  try {
    const { city, type, status, minPrice, maxPrice, rooms, search, bbox, page = 1, limit = 12, publishedBy, ids } = req.query;

    // ?bbox=lat1,lng1,lat2,lng2 — las dos esquinas del viewport del mapa.
    // Pensado para un futuro "buscar en esta área": el mapa manda sus
    // límites en vez de depender solo del limit=50 fijo de hoy.
    const idsArray = ids ? String(ids).split(',').filter(Boolean) : undefined;
    const whereClause = buildPropertyWhere({ search, city, type, status, rooms, minPrice, maxPrice, bbox: parseBbox(bbox), ids: idsArray, publishedBy });

    const pageNum  = Math.max(1, parseInt(page));
    // ?ids= y ?publishedBy= son consultas del propio usuario (favoritos, "mis
    // propiedades"): el tope público de 50 les cortaba la lista a la mitad.
    // 200 sigue siendo un tope razonable, no hay lista infinita que paginar
    // en esas pantallas.
    const maxTake  = (idsArray || publishedBy) ? 200 : 50;
    const limitNum = Math.min(maxTake, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // Promise.all en vez de prisma.$transaction([...]): dentro de una
    // transacción, Postgres corre las dos queries en serie sobre la misma
    // conexión (una transacción es una sola sesión). Acá no necesitamos que
    // "total" y "properties" vengan de la misma foto exacta de la tabla —es
    // un listado, no una operación financiera— así que las mandamos en
    // paralelo por dos conexiones del pool y cortamos la latencia a la mitad.
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where: whereClause,
        include: { publishedBy: PUBLISHER_SELECT },
        // Desempatado por id: con createdAt solo, dos filas con el mismo
        // timestamp (algo real con datos sembrados en lote) pueden quedar en
        // cualquier orden entre una página y la siguiente — a veces
        // repetidas, a veces salteadas. (createdAt, id) es un orden
        // determinístico, cubierto de punta a punta por el índice
        // @@index([createdAt, id]).
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.property.count({ where: whereClause }),
    ]);

    const responseProperties = req.user
      ? properties
      : properties.map((p) => ({ ...p, lat: roundToZone(p.lat), lng: roundToZone(p.lng) }));

    res.status(200).json({
      properties: responseProperties,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore:    pageNum < Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getProperties error:', error);
    res.status(500).json({ error: 'Error al obtener las propiedades.' });
  }
};



// 3. OBTENER UNA PROPIEDAD POR ID
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        publishedBy: PUBLISHER_SELECT
      }
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada.' });
    }

    // Sin sesión, ni siquiera mandamos lat/lng — el mapa en el detalle está
    // bloqueado por completo hasta iniciar sesión (no una zona aproximada).
    if (!req.user) {
      const { lat, lng, ...withoutExactLocation } = property;
      return res.status(200).json(withoutExactLocation);
    }

    res.status(200).json(property);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la propiedad.' });
  }
};

// 4. ACTUALIZAR UNA PROPIEDAD
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la propiedad existe y que el usuario es el dueño
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Propiedad no encontrada.' });
    if (!isOwner(existing.publishedById, req, res)) return;

    // Whitelist explícito — sin esto, cualquier campo del modelo (verified,
    // publishedById, etc.) viajaba tal cual desde el body al UPDATE de
    // Prisma. El dueño de una propiedad podía auto-verificarla mandando
    // { verified: true }, o transferirla a otra cuenta mandando
    // { publishedById: "<otro-uuid>" }.
    const EDITABLE_FIELDS = [
      'title', 'description', 'price', 'currency', 'city', 'sector', 'type', 'status',
      'rooms', 'baths', 'parking', 'lat', 'lng', 'images',
      'videoUrl', 'virtualTourUrl',
    ];
    const dataToUpdate = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) dataToUpdate[field] = req.body[field];
    }

    if (!isSafeHttpUrl(dataToUpdate.videoUrl) || !isSafeHttpUrl(dataToUpdate.virtualTourUrl)) {
      return res.status(400).json({ error: 'Los enlaces de video/tour deben ser URLs válidas.' });
    }

    // El formulario manda "" para "quitar el video" — lo normalizamos a null
    // para no guardar una URL vacía que el frontend trataría como válida.
    if (dataToUpdate.videoUrl === "") dataToUpdate.videoUrl = null;
    if (dataToUpdate.virtualTourUrl === "") dataToUpdate.virtualTourUrl = null;

    if (dataToUpdate.title !== undefined)       dataToUpdate.title       = stripHtmlTags(dataToUpdate.title);
    if (dataToUpdate.description !== undefined) dataToUpdate.description = stripHtmlTags(dataToUpdate.description);

    // Convertimos datos numéricos si es que vienen en la actualización
    if (dataToUpdate.price !== undefined) dataToUpdate.price = parseFloat(dataToUpdate.price);
    if (dataToUpdate.lat !== undefined) dataToUpdate.lat = parseFloat(dataToUpdate.lat);
    if (dataToUpdate.lng !== undefined) dataToUpdate.lng = parseFloat(dataToUpdate.lng);
    if (dataToUpdate.rooms !== undefined) dataToUpdate.rooms = parseInt(dataToUpdate.rooms);
    if (dataToUpdate.baths !== undefined) dataToUpdate.baths = parseInt(dataToUpdate.baths);
    if (dataToUpdate.parking !== undefined) dataToUpdate.parking = parseInt(dataToUpdate.parking);

    const updatedProperty = await prisma.property.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.status(200).json({ message: 'Propiedad actualizada con éxito', property: updatedProperty });
  } catch (error) {
    // Capturamos el error controlado antes de que rompa la terminal
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'La propiedad que intentas actualizar no existe.' });
    }
    console.error("Error en updateProperty:", error);
    return res.status(500).json({ error: 'Error al actualizar la propiedad.' });
  }
};

// 5. ELIMINAR UNA PROPIEDAD
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la propiedad existe y que el usuario es el dueño
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Propiedad no encontrada.' });
    if (!isOwner(existing.publishedById, req, res)) return;

    await prisma.property.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Propiedad eliminada correctamente.' });
  } catch (error) {
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'La propiedad que intentas eliminar no existe.' });
    }
    console.error("Error en deleteProperty:", error);
    return res.status(500).json({ error: 'Error al eliminar la propiedad.' });
  }
};

// EXPORTAMOS LAS 5 FUNCIONES LIMPIAMENTE
module.exports = { 
  createProperty, 
  getProperties, 
  getPropertyById, 
  updateProperty, 
  deleteProperty 
};