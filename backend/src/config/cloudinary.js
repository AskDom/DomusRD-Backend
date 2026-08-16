const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

// Verifica la firma REAL del archivo (magic bytes), no solo el mimetype que
// manda el cliente — ese se puede falsear con un curl. Un archivo HTML (o
// SVG poliglota) nombrado ".png" pasaba el fileFilter viejo basado solo en
// mimetype; la firma del contenido no se puede inventar.
function isValidImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const b = buf;
  // JPEG: FF D8 FF
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
      b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return true;
  // WEBP: "RIFF" + 4 bytes de largo + "WEBP"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true;
  return false;
}

// fileFilter queda solo para dar un error claro por mimetype desconocido; la
// decisión fuerte (magic bytes) se toma en el controller con el buffer ya en
// memoria, después de que multer parseó y limitó el tamaño del archivo.
const imageFileFilter = (req, file, cb) => {
  if (!(file.mimetype in MIME_TO_EXT)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP.'));
  }
  cb(null, true);
};

// Almacenamiento en memoria en vez de multer-storage-cloudinary: sin el
// buffer en memoria no había forma de inspeccionar la firma del archivo
// antes de subirlo a Cloudinary (el storage anterior lo stream-eaba directo).
// Límite de 6 imágenes por propiedad, máximo 5 MB cada una.
const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: 5 * 1024 * 1024 },
  fileFilter:  imageFileFilter,
});

// Una sola imagen por usuario, máximo 3 MB
const uploadAvatar = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: 3 * 1024 * 1024 },
  fileFilter:  imageFileFilter,
});

// Sube un buffer YA validado a Cloudinary con la transformación del folder.
// Devuelve el resultado de Cloudinary (con .secure_url, .public_id, etc.).
function uploadBufferToCloudinary(buffer, { folder, transformation }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation,
        // Aunque los magic bytes ya fueron validados, la lista explícita
        // refuerza que Cloudinary no reciba formatos fuera de los nuestros.
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, upload, uploadAvatar, isValidImageBuffer, uploadBufferToCloudinary };
