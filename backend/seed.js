const prisma = require('./src/config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear usuarios de prueba
  const hashedPassword = await bcrypt.hash('123456', 10);

  const vendedor = await prisma.user.upsert({
    where:  { email: 'vendedor@domusrd.com' },
    update: {},
    create: {
      name:          'Carlos Vendedor',
      email:         'vendedor@domusrd.com',
      password:      hashedPassword,
      role:          'VENDEDOR',
      emailVerified: true,
    },
  });

  const agente = await prisma.user.upsert({
    where:  { email: 'agente@domusrd.com' },
    update: {},
    create: {
      name:          'María Agente',
      email:         'agente@domusrd.com',
      password:      hashedPassword,
      role:          'AGENTE',
      emailVerified: true,
    },
  });

  console.log('✅ Usuarios creados:', vendedor.name, '|', agente.name);

  // Propiedades de prueba
  const properties = [
    {
      title:        'Apartamento moderno en Piantini',
      description:  'Hermoso apartamento completamente remodelado en el corazón de Piantini. Acabados de lujo, cocina americana y balcón con vista a la ciudad.',
      price:        12500000,
      city:         'Santo Domingo',
      type:         'APARTAMENTO',
      status:       'VENTA',
      rooms:        3, baths: 2, parking: 1,
      lat: 18.4762, lng: -69.9312,
      images:       ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'],
      publishedById: vendedor.id,
    },
    {
      title:        'Villa de lujo en Casa de Campo',
      description:  'Espectacular villa con piscina privada, jardín tropical y acceso directo al campo de golf. Ideal para familia o inversión.',
      price:        85000000,
      city:         'La Romana',
      type:         'VILLA',
      status:       'VENTA',
      rooms:        5, baths: 4, parking: 3,
      lat: 18.4271, lng: -68.9654,
      images:       ['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800'],
      publishedById: agente.id,
    },
    {
      title:        'Apartamento en renta en Naco',
      description:  'Cómodo apartamento amueblado en Naco, cerca de restaurantes y centros comerciales. Disponible inmediatamente.',
      price:        35000,
      city:         'Santo Domingo',
      type:         'APARTAMENTO',
      status:       'RENTA',
      rooms:        2, baths: 1, parking: 1,
      lat: 18.4801, lng: -69.9401,
      images:       ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
      publishedById: vendedor.id,
    },
    {
      title:        'Casa familiar en Los Jardines del Norte',
      description:  'Amplia casa de dos plantas con patio, área de BBQ y cuarto de servicio. Excelente ubicación cerca de colegios.',
      price:        8900000,
      city:         'Santo Domingo',
      type:         'CASA',
      status:       'VENTA',
      rooms:        4, baths: 3, parking: 2,
      lat: 18.5012, lng: -69.9178,
      images:       ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800'],
      publishedById: agente.id,
    },
    {
      title:        'Apartamento frente al mar en Juan Dolio',
      description:  'Increíble apartamento con vista panorámica al mar Caribe. Acceso directo a la playa privada y amenidades de resort.',
      price:        18500000,
      city:         'Juan Dolio',
      type:         'APARTAMENTO',
      status:       'VENTA',
      rooms:        3, baths: 2, parking: 1,
      lat: 18.4285, lng: -69.4090,
      images:       ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800'],
      publishedById: vendedor.id,
    },
    {
      title:        'Villa en renta en Cap Cana',
      description:  'Villa de lujo con piscina infinita y acceso a marina privada. Perfecta para vacaciones o estadía larga.',
      price:        250000,
      city:         'Punta Cana',
      type:         'VILLA',
      status:       'RENTA',
      rooms:        4, baths: 4, parking: 2,
      lat: 18.4896, lng: -68.4046,
      images:       ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800'],
      publishedById: agente.id,
    },
    {
      title:        'Casa en Santiago centro',
      description:  'Casa colonial restaurada con amplios espacios, techos altos y patio interior. Ideal para oficina o vivienda.',
      price:        6500000,
      city:         'Santiago',
      type:         'CASA',
      status:       'VENTA',
      rooms:        3, baths: 2, parking: 1,
      lat: 19.4517, lng: -70.6970,
      images:       ['https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800'],
      publishedById: vendedor.id,
    },
    {
      title:        'Estudio moderno en Bella Vista',
      description:  'Estudio completamente equipado en edificio con gimnasio y rooftop. Perfecto para solteros o parejas.',
      price:        22000,
      city:         'Santo Domingo',
      type:         'APARTAMENTO',
      status:       'RENTA',
      rooms:        1, baths: 1, parking: 0,
      lat: 18.4689, lng: -69.9451,
      images:       ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'],
      publishedById: agente.id,
    },
  ];

  let created = 0;
  for (const prop of properties) {
    await prisma.property.create({ data: prop });
    created++;
    console.log(`  ✅ ${prop.title}`);
  }

  console.log(`\n🎉 Seed completado: ${created} propiedades creadas`);
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());