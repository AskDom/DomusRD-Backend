const { PrismaClient } = require('@prisma/client');
const { isOwner } = require('../middlewares/auth.middleware');
const prisma = new PrismaClient();

// 1. CREAR UNA PROPIEDAD
const createProperty = async (req, res) => {
  try {
    const { 
      title, description, price, city, 
      lat, lng, rooms, baths, parking, type, status, images
    } = req.body;

    // Aceptamos tanto "userId" como "publishedById" por compatibilidad con el frontend
    const userId = req.body.userId || req.body.publishedById;

    console.log('📦 Body recibido en createProperty:', req.body);
    console.log('🔑 userId resuelto:', userId);

    if (!title || !price || !city || !userId || lat === undefined || lng === undefined) {
      return res.status(400).json({ 
        error: 'Título, precio, ciudad, lat, lng y userId son obligatorios.' 
      });
    }

    // Validar que el userId existe en la BD antes de intentar conectar
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(400).json({ error: `Usuario con id "${userId}" no encontrado.` });
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
        publishedBy: { select: { id: true, name: true, email: true } }
      }
    });

    console.log('✅ Propiedad creada:', newProperty.id);
    res.status(201).json({ message: 'Propiedad publicada con éxito', property: newProperty });
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

    const whereClause = {};

    // Búsqueda por texto (título o ciudad)
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { city:  { contains: search, mode: 'insensitive' } },
      ];
    }

    if (city)     whereClause.city   = { contains: city, mode: 'insensitive' };
    if (type)     whereClause.type   = type.toUpperCase();
    if (status)   whereClause.status = status.toUpperCase();
    if (rooms)    whereClause.rooms  = { gte: parseInt(rooms) };
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [properties, total] = await prisma.$transaction([
      prisma.property.findMany({
        where: whereClause,
        include: { publishedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.property.count({ where: whereClause }),
    ]);

    res.status(200).json({
      properties,
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
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada.' });
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