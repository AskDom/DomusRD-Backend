const prisma = require('./src/config/prisma');

// Complementa a seed.js: agrega más propiedades sin tocar ni duplicar las
// que ya existen (esas usan `create`, no `upsert`, así que correr seed.js
// de nuevo las duplicaría — por eso este es un script aparte).
async function main() {
  console.log('🌱 Ampliando catálogo...');

  const vendedor = await prisma.user.findUnique({ where: { email: 'vendedor@domify.com' } });
  const agente = await prisma.user.findUnique({ where: { email: 'agente@domify.com' } });
  if (!vendedor || !agente) {
    throw new Error('Corré primero `node seed.js` — no existen los usuarios de prueba.');
  }

  // Mismas fotos que ya usa seed.js (confirmadas funcionando en la app) —
  // se combinan distinto por propiedad para que cada card tenga 3 fotos y
  // se pueda probar el swipe del carrusel.
  const IMG = [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
    'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
  ];
  const pics = (...idx) => idx.map((i) => IMG[i]);

  const properties = [
    {
      title: 'Penthouse con vista al mar en Bávaro',
      description: 'Penthouse de dos niveles con terraza privada y vista panorámica al Caribe. A pasos de la playa y de los principales resorts.',
      price: 32000000, city: 'Punta Cana', type: 'APARTAMENTO', status: 'VENTA',
      rooms: 4, baths: 3, parking: 2, lat: 18.6825, lng: -68.4056,
      images: pics(4, 1, 0), verified: true, publishedById: agente.id,
    },
    {
      title: 'Villa frente a la playa en Las Terrenas',
      description: 'Villa estilo caribeño a metros de la arena, con piscina infinita y jardín tropical. Ideal para renta vacacional o residencia.',
      price: 68000000, city: 'Las Terrenas', type: 'VILLA', status: 'VENTA',
      rooms: 5, baths: 5, parking: 3, lat: 19.3167, lng: -69.5417,
      images: pics(1, 5, 4), verified: true, publishedById: agente.id,
    },
    {
      title: 'Apartamento amueblado en Gazcue',
      description: 'Apartamento totalmente amueblado en zona histórica y arbolada, a minutos del Malecón y del centro de la ciudad.',
      price: 42000, city: 'Santo Domingo', type: 'APARTAMENTO', status: 'RENTA',
      rooms: 2, baths: 2, parking: 1, lat: 18.4715, lng: -69.8967,
      images: pics(2, 7), verified: false, publishedById: vendedor.id,
    },
    {
      title: 'Casa de campo en Jarabacoa',
      description: 'Casa de montaña con clima fresco todo el año, chimenea y vista a los pinares. Escape ideal del calor de la capital.',
      price: 11200000, city: 'Jarabacoa', type: 'CASA', status: 'VENTA',
      rooms: 4, baths: 3, parking: 2, lat: 19.1167, lng: -70.6333,
      images: pics(3, 6, 2), verified: true, publishedById: vendedor.id,
    },
    {
      title: 'Apartamento en Evaristo Morales',
      description: 'Apartamento nuevo en construcción de calidad, cerca de oficinas y del Malecón Center. Ascensor y área social en el edificio.',
      price: 9800000, city: 'Santo Domingo', type: 'APARTAMENTO', status: 'VENTA',
      rooms: 2, baths: 2, parking: 1, lat: 18.4735, lng: -69.9280,
      images: pics(0, 2), verified: false, publishedById: agente.id,
    },
    {
      title: 'Villa en Sosúa con piscina',
      description: 'Villa de un nivel con piscina privada y terraza techada, a cinco minutos de la playa. Amueblada, lista para entrar a vivir.',
      price: 180000, city: 'Sosúa', type: 'VILLA', status: 'RENTA',
      rooms: 3, baths: 3, parking: 2, lat: 19.7524, lng: -70.5187,
      images: pics(5, 1, 3), verified: true, publishedById: agente.id,
    },
    {
      title: 'Casa moderna en Cerros de Gurabo',
      description: 'Casa de diseño contemporáneo en urbanización cerrada con seguridad 24/7, área de juegos y club social.',
      price: 14500000, city: 'Santiago', type: 'CASA', status: 'VENTA',
      rooms: 4, baths: 4, parking: 2, lat: 19.4550, lng: -70.6900,
      images: pics(6, 3), verified: false, publishedById: vendedor.id,
    },
    {
      title: 'Apartamento frente al Malecón de Puerto Plata',
      description: 'Apartamento remodelado con vista directa al mar, balcón amplio y edificio con generador. A pasos del centro histórico.',
      price: 7300000, city: 'Puerto Plata', type: 'APARTAMENTO', status: 'VENTA',
      rooms: 3, baths: 2, parking: 1, lat: 19.7934, lng: -70.6884,
      images: pics(4, 0, 7), verified: true, publishedById: vendedor.id,
    },
    {
      title: 'Estudio cerca de la playa en Boca Chica',
      description: 'Estudio compacto y funcional a cinco minutos caminando de la playa. Ideal para primera inversión o renta corta.',
      price: 18000, city: 'Boca Chica', type: 'APARTAMENTO', status: 'RENTA',
      rooms: 1, baths: 1, parking: 0, lat: 18.4515, lng: -69.6039,
      images: pics(7, 2), verified: false, publishedById: agente.id,
    },
    {
      title: 'Villa con vista a la montaña en Constanza',
      description: 'Villa en el valle de Constanza, rodeada de sembradíos y montañas. Clima fresco, terreno amplio con frutales.',
      price: 15800000, city: 'Constanza', type: 'VILLA', status: 'VENTA',
      rooms: 4, baths: 3, parking: 2, lat: 18.9106, lng: -70.7434,
      images: pics(1, 6, 5), verified: false, publishedById: vendedor.id,
    },
    {
      title: 'Apartamento ejecutivo en Piantini',
      description: 'Apartamento de lujo en torre con gimnasio, piscina y lobby 24 horas. A pasos de restaurantes y oficinas corporativas.',
      price: 55000, city: 'Santo Domingo', type: 'APARTAMENTO', status: 'RENTA',
      rooms: 2, baths: 2, parking: 1, lat: 18.4770, lng: -69.9330,
      images: pics(0, 4, 2), verified: true, publishedById: agente.id,
    },
    {
      title: 'Casa familiar en Higüey',
      description: 'Casa de un nivel en zona residencial tranquila, patio grande y cocina remodelada. Cerca del centro y de colegios.',
      price: 5600000, city: 'Higüey', type: 'CASA', status: 'VENTA',
      rooms: 3, baths: 2, parking: 2, lat: 18.6167, lng: -68.7000,
      images: pics(3, 7), verified: false, publishedById: vendedor.id,
    },
    {
      title: 'Apartamento frente al mar en Cabarete',
      description: 'Apartamento con vista al kitesurf spot de Cabarete, balcón frente al mar y edificio con piscina. Amueblado.',
      price: 95000, city: 'Cabarete', type: 'APARTAMENTO', status: 'RENTA',
      rooms: 2, baths: 2, parking: 1, lat: 19.7500, lng: -70.4167,
      images: pics(4, 5, 0), verified: true, publishedById: agente.id,
    },
    {
      title: 'Villa en Las Galeras, Samaná',
      description: 'Villa exclusiva sobre acantilado con vista a la bahía de Las Galeras, acceso a playa privada y jardín tropical.',
      price: 42000000, city: 'Samaná', type: 'VILLA', status: 'VENTA',
      rooms: 5, baths: 4, parking: 3, lat: 19.3167, lng: -69.2500,
      images: pics(1, 6, 4), verified: false, publishedById: agente.id,
    },
  ];

  let created = 0;
  for (const prop of properties) {
    await prisma.property.create({ data: prop });
    created++;
    console.log(`  ✅ ${prop.title} (${prop.city})`);
  }

  console.log(`\n🎉 ${created} propiedades nuevas agregadas al catálogo`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
