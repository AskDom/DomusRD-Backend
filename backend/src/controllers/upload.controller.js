const { cloudinary } = require('../config/cloudinary');

// POST /api/upload  — recibe hasta 6 imágenes y devuelve sus URLs
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron imágenes.' });
    }

    // multer-storage-cloudinary ya subió los archivos; solo extraemos las URLs
    const urls = req.files.map((f) => f.path);
    return res.status(200).json({ urls });
  } catch (error) {
    console.error('❌ Error en uploadImages:', error);
    return res.status(500).json({ error: 'Error al subir las imágenes.' });
  }
};

// DELETE /api/upload  — elimina una imagen de Cloudinary por su URL pública
const deleteImage = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Se requiere la URL de la imagen.' });

    // Extraemos el public_id de la URL de Cloudinary
    // Ejemplo URL: https://res.cloudinary.com/demo/image/upload/v123/domify/properties/abc123.jpg
    const parts  = url.split('/');
    const file   = parts[parts.length - 1].split('.')[0]; // "abc123"
    const folder = parts[parts.length - 2];               // "properties"
    const publicId = `domify/${folder}/${file}`;

    await cloudinary.uploader.destroy(publicId);
    return res.status(200).json({ message: 'Imagen eliminada.' });
  } catch (error) {
    console.error('❌ Error en deleteImage:', error);
    return res.status(500).json({ error: 'Error al eliminar la imagen.' });
  }
};

module.exports = { uploadImages, deleteImage };