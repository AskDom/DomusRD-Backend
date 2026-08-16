const prisma = require("../../src/config/prisma");

// Cinturón de seguridad: si por lo que sea DATABASE_URL no apunta a la DB de
// test (p.ej. se corrió jest sin pasar por "npm test"), abortamos en vez de
// arriesgarnos a vaciar la base de datos de desarrollo.
if (!/domify_test/.test(process.env.DATABASE_URL || "")) {
  throw new Error(
    `tests/helpers/testDb.js: DATABASE_URL no apunta a la base de datos de test ` +
    `(actual: ${process.env.DATABASE_URL}). Corre los tests con "npm test".`
  );
}

// Borra en orden seguro para las foreign keys. Se usa entre tests de
// integración para que cada archivo empiece con la base de datos de test limpia.
async function resetDb() {
  await prisma.visit.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.savedSearch.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = { prisma, resetDb };
