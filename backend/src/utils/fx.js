// Tipo de cambio USD → DOP usado para mostrar equivalencias en moneda local
// (p.ej. "US$95,000 ≈ RD$5.7M"). Es una tasa manual, configurable por env
// para ajustarla sin deploy — el valor por defecto (60) es el mismo fallback
// que ya usaba el frontend web. El cliente lo consume en GET /api/rates.

const DEFAULT_USD_TO_DOP = 60;

function getRates() {
  const usdToDop = Number(process.env.FX_USD_TO_DOP) || DEFAULT_USD_TO_DOP;
  return {
    usdToDop,
    // Milisegundos desde epoch — permite que el cliente guarde la tasa en
    // caché y la considere fresca por un rato sin pedirla de nuevo.
    updatedAt: Date.now(),
    source:    process.env.FX_RATE_SOURCE || "manual",
  };
}

module.exports = { getRates };
