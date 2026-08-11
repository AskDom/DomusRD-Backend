const sanitizeHtml = require('sanitize-html');

// Defensa en profundidad: quita cualquier cosa con forma de etiqueta HTML del
// texto libre antes de guardarlo. El frontend web ya escapa al renderizar
// (JSX no usa innerHTML), pero el backend no debe depender solo de eso — así
// queda protegido cualquier cliente futuro que sí renderice con innerHTML o
// un WebView.
//
// Antes esto era una regex (/<[^>]*>/g) que no detectaba un tag sin cerrar
// (ej. `<img src=x onerror=alert(1)//`), dejándolo guardado tal cual.
// sanitize-html parsea HTML de verdad, así que sí lo detecta y lo descarta.
//
// Al no permitir ningún tag, sanitize-html re-serializa el texto
// sobreviviente como HTML válido — entity-encodeando & < > sueltos (ej. un
// título "3 < 4 dorm" -> "3 &lt; 4 dorm"). Como estos campos siempre se
// tratan como texto plano en los clientes (nadie los decodea al mostrarlos),
// hay que revertir ese encoding acá o el usuario terminaría viendo "&lt;"
// literal en vez de "<".
function decodeBasicEntities(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function stripHtmlTags(text) {
  if (typeof text !== 'string') return text;
  const withoutTags = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
  return decodeBasicEntities(withoutTags).trim();
}

module.exports = { stripHtmlTags };
