const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. CREAR UNA PROPIEDAD
const createProperty = async (req, res) => {
  try {
    const { 
      title, description, price, city, 
      lat, lng, rooms, baths, parking, type, userId 
    } = req.body;

    if (!title || !price || !city || !userId || lat === undefined || lng === undefined) {
      return res.status(400).json({ 
        error: 'Título, precio, ubicación, ciudad, lat, lng y userId son obligatorios.' 
      });
    }

    const newProperty = await prisma.property.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        city,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        rooms: parseInt(rooms) || 0,
        baths: parseInt(baths) || 0,
        parking: parseInt(parking) || 0,
        type,
        publishedBy: {
          connect: { id: userId }
        }
      },
    });

    res.status(201).json({ message: 'Propiedad publicada con éxito', property: newProperty });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor al crear la propiedad.' });
  }
};

// 2. OBTENER TODAS LAS PROPIEDADES (Con filtro)
const getProperties = async (req, res) => {
  try {
    const { city } = req.query;

    const whereClause = city ? {
      city: {
        equals: city,
        mode: 'insensitive'
      }
    } : {};

    const properties = await prisma.property.findMany({
      where: whereClause,
      include: {
        publishedBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(properties);
  } catch (error) {
    console.error(error);
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