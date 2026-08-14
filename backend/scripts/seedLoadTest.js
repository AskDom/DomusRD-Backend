// Seed masivo para pruebas de carga. Aislado de seed.js/seedExtra.js a
// propósito: este script está pensado para correr contra una base de datos
// separada (domify_loadtest), nunca contra la base de datos de desarrollo.
//
// Uso:
//   DATABASE_URL="postgresql://domify:domify_dev_password@localhost:5432/domify_loadtest?schema=public" \
//     node scripts/seedLoadTest.js 20000

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const COUNT = parseInt(process.argv[2]) || 20000;
const BATCH_SIZE = 2000;

// Centros de ciudades reales de RD + radio de dispersión en grados
// (~0.15° ≈ 15km) para que los puntos caigan en el mapa de forma realista.
const CITIES = [
  { city: 'Santo Domingo', sector: 'Piantini',        lat: 18.4762, lng: -69.9312 },
  { city: 'Santo Domingo', sector: 'Naco',             lat: 18.4695, lng: -69.9376 },
  { city: 'Santo Domingo', sector: 'Bella Vista',       lat: 18.4535, lng: -69.9520 },
  { city: 'Santo Domingo', sector: 'Gazcue',           lat: 18.4715, lng: -69.8967 },
  { city: 'Santiago',      sector: 'Los Jardines',      lat: 19.4517, lng: -70.6970 },
  { city: 'Punta Cana',    sector: 'Bávaro',            lat: 18.6825, lng: -68.4056 },
  { city: 'La Romana',     sector: 'Casa de Campo',      lat: 18.4271, lng: -68.9654 },
  { city: 'Las Terrenas',  sector: 'Playa Bonita',       lat: 19.3167, lng: -69.5417 },
  { city: 'Jarabacoa',     sector: 'Los Pinos',          lat: 19.1167, lng: -70.6333 },
  { city: 'Puerto Plata',  sector: 'Costambar',          lat: 19.7935, lng: -70.6884 },
];

const TYPES    = ['APARTAMENTO', 'CASA', 'VILLA'];
const STATUSES = ['VENTA', 'RENTA'];
const CURRENCIES = ['USD', 'DOP'];
const IMG = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800';

const rand  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randF = (min, max) => Math.random() * (max - min) + min;
const randI = (min, max) => Math.floor(randF(min, max + 1));

function jitter(center, spread) {
  return center + randF(-spread, spread);
}

async function main() {
  console.log(`Seed de carga: ${COUNT} propiedades`);

  const hashedPassword = await bcrypt.hash('123456', 10);
  const seeder = await prisma.user.upsert({
    where:  { email: 'loadtest@domify.com' },
    update: {},
    create: {
      name: 'Load Test Seeder',
      email: 'loadtest@domify.com',
      password: hashedPassword,
      role: 'AGENTE',
    },
  });

  let created = 0;
  const start = Date.now();

  while (created < COUNT) {
    const batchSize = Math.min(BATCH_SIZE, COUNT - created);
    const batch = Array.from({ length: batchSize }, (_, i) => {
      const place = rand(CITIES);
      const type = rand(TYPES);
      const n = created + i;
      return {
        title: `${type === 'CASA' ? 'Casa' : type === 'VILLA' ? 'Villa' : 'Apartamento'} en ${place.sector} #${n}`,
        description: 'Propiedad generada para prueba de carga. Descripción de relleno con texto suficiente para simular un caso real de producción.',
        price: randF(30000, 90000000),
        currency: rand(CURRENCIES),
        city: place.city,
        sector: place.sector,
        type,
        status: rand(STATUSES),
        rooms: randI(1, 6),
        baths: randI(1, 5),
        parking: randI(0, 3),
        lat: jitter(place.lat, 0.15),
        lng: jitter(place.lng, 0.15),
        images: [IMG],
        verified: Math.random() < 0.3,
        publishedById: seeder.id,
      };
    });

    await prisma.property.createMany({ data: batch });
    created += batchSize;
    process.stdout.write(`\r  ${created}/${COUNT} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  }

  console.log(`\nListo. ${created} propiedades insertadas en ${((Date.now() - start) / 1000).toFixed(1)}s.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
