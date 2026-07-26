const { PrismaClient } = require('@prisma/client');
const { isOwner } = require('../middlewares/auth.middleware');
const { buildPropertyWhere } = require('../utils/propertyFilters');
const { notifyMatchingSavedSearches } = require('../utils/savedSearchNotifier');
const prisma = new PrismaClient();

// La ubicación exacta es una de las razones para crear cuenta — sin sesión
// solo devolvemos una zona aproximada (grilla de ~1km), nunca el punto real.
// Esto respalda en el backend lo que el frontend ya oculta visualmente: sin
// esto, cualquiera podría ver la petición de red y sacar lat/lng exactos.
const roundToZone = (n) => Math.round(n * 100) / 100;

// 1. CREAR UNA PROPIEDAD
const createProperty = async (req, res) => {
  try {
    const { 
      title, description, price, city, 
      lat, lng, rooms, baths, parking, type, status, images
    } = req.body;

    // El dueño de la propiedad es siempre el usuario autenticado (del token),
    // nunca un valor que venga del body — evita que alguien publique a nombre de otro.
    const userId = req.user.userId;

    if (!title || !price || !city || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Título, precio, ciudad, lat y lng son obligatorios.'
      });
    }

    const newProperty = await prisma.property.create({
      data: {
        title,
        description: description || '',
        price: parseFloat(price),
        city,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        rooms: parseInt(rooms) || 1,
        baths: parseInt(baths) || 1,
        parking: parseInt(parking) || 0,
        type: type || 'APARTAMENTO',
        status: status || 'VENTA',
        images: images || [],
        publishedBy: {
          connect: { id: userId }
        }
      },
      include: {
        publishedBy: { select: { id: true, name: true, email: true, avatar: true } }
      }
    });

    console.log('✅ Propiedad creada:', newProperty.id);
    res.status(201).json({ message: 'Propiedad publicada con éxito', property: newProperty });

    // No bloquea la respuesta — la comparación contra búsquedas guardadas
    // corre en segundo plano después de responderle al que publicó.
    notifyMatchingSavedSearches(newProperty, req.app.get('io'));
  } catch (error) {
    console.error('❌ Error en createProperty:', error);
    res.status(500).json({ error: 'Error en el servidor al crear la propiedad.', detail: error.message });
  }
};

// 2. OBTENER TODAS LAS PROPIEDADES (Con filtro)
const getProperties = async (req, res) => {
  try {
    console.log("📋 getProperties llamado con query:", req.query);
    const { city, type, status, minPrice, maxPrice, rooms, search, page = 1, limit = 12 } = req.query;

    const whereClause = buildPropertyWhere({ search, city, type, status, rooms, minPrice, maxPrice });

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [properties, total] = await prisma.$transaction([
      prisma.property.findMany({
        where: whereClause,
        include: { publishedBy: { select: { id: true, name: true, email: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
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
        publishedBy: {
          select: { id: true, name: true, email: true, avatar: true }
        }
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

    console.log('📦 updateProperty body:', req.body);
    const dataToUpdate = { ...req.body };

    // Convertimos datos numéricos si es que vienen en la actualización
    if (dataToUpdate.price !== undefined) dataToUpdate.price = parseFloat(dataToUpdate.price);
    if (dataToUpdate.lat !== undefined) dataToUpdate.lat = parseFloat(dataToUpdate.lat);
    if (dataToUpdate.lng !== undefined) dataToUpdate.lng = parseFloat(dataToUpdate.lng);
    if (dataToUpdate.rooms !== undefined) dataToUpdate.rooms = parseInt(dataToUpdate.rooms);
    if (dataToUpdate.baths !== undefined) dataToUpdate.baths = parseInt(dataToUpdate.baths);
    if (dataToUpdate.parking !== undefined) dataToUpdate.parking = parseInt(dataToUpdate.parking);

    // Evitamos alterar la relación directamente pasando el userId plano
    delete dataToUpdate.userId;

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