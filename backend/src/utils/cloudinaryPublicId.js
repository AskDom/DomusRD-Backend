// Extrae el public_id de Cloudinary a partir de la URL que devuelve al subir
// una imagen. Ejemplo de URL: https://res.cloudinary.com/demo/image/upload/v123/domify/properties/abc123.jpg
// Compartido entre uploadImages (para registrar quién subió qué) y
// deleteImage (para saber qué borrar en Cloudinary), así ambos calculan el
// mismo public_id de la misma forma.
function publicIdFromUrl(url) {
  const parts  = url.split('/');
  const file   = parts[parts.length - 1].split('.')[0]; // "abc123"
  const folder = parts[parts.length - 2];               // "properties"
  return `domify/${folder}/${file}`;
}

module.exports = { publicIdFromUrl };
