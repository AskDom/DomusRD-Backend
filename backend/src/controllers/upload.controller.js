const { cloudinary } = require('../config/cloudinary');
const prisma = require('../config/prisma');
const { publicIdFromUrl } = require('../utils/cloudinaryPublicId');

// POST /api/upload  — recibe hasta 6 imágenes y devuelve sus URLs
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron imágenes.' });
    }

    // multer-storage-cloudinary ya subió los archivos; solo extraemos las URLs.
    // Registramos quién subió cada una — es lo único que después decide si
    // puede borrarla (ver deleteImage), no si la URL "aparece" en alguna
    // propiedad suya.
    const userId = req.user.userId;
    const urls = req.files.map((f) => f.path);
    await prisma.uploadedImage.createMany({
      data: urls.map((url) => ({ url, publicId: publicIdFromUrl(url), userId })),
      skipDuplicates: true,
    });

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

    // El permiso depende de quién la subió (tabla uploadedImage, llenada en
    // uploadImages) o de que sea el propio avatar del usuario — nunca de si
    // la URL "aparece" en el array `images` de una propiedad, porque ese
    // array lo puede editar el propio dueño con cualquier URL de Cloudinary
    // (incluida la de la foto de OTRO usuario, copiada de un listado
    // público). Si no hay registro de quién la subió (imagen previa a este
    // control) y tampoco es el avatar propio, se deniega — sin excepciones
    // que reabran el mismo agujero.
    const userId = req.user.userId;
    const [uploadedImage, user] = await Promise.all([
      prisma.uploadedImage.findUnique({ where: { url } }),
      prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } }),
    ]);
    const ownsUpload = uploadedImage?.userId === userId;
    const isOwnAvatar = user?.avatar === url;
    if (!ownsUpload && !isOwnAvatar) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta imagen.' });
    }

    await cloudinary.uploader.destroy(publicIdFromUrl(url));
    if (uploadedImage) {
      await prisma.uploadedImage.delete({ where: { url } });
    }
    return res.status(200).json({ message: 'Imagen eliminada.' });
  } catch (error) {
    console.error('❌ Error en deleteImage:', error);
    return res.status(500).json({ error: 'Error al eliminar la imagen.' });
  }
};

module.exports = { uploadImages, deleteImage };