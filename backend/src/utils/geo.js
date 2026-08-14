// La ubicación exacta es una de las razones para crear cuenta — sin sesión
// solo devolvemos una zona aproximada (grilla de ~1km), nunca el punto real.
// Compartido entre property.controller.js y user.controller.js para que
// ambos apliquen exactamente el mismo criterio (ver GET /api/users/:id, que
// lista las propiedades de un usuario igual que GET /api/properties).
const roundToZone = (n) => Math.round(n * 100) / 100;

module.exports = { roundToZone };
