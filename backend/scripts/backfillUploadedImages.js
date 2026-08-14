// Corre una sola vez después de la migración add_uploaded_image_ownership:
// llena uploaded_images a partir de los datos que YA existen, atribuyendo
// cada imagen al dueño actual de la propiedad/avatar que la referencia. Sin
// esto, cualquier imagen subida antes de este control quedaría sin dueño
// registrado y su dueño real no podría borrarla más (deleteImage ahora
// deniega por defecto cuando no hay registro). Solo hace INSERT — no toca
// ni borra nada existente.
const prisma = require("../src/config/prisma");
const { publicIdFromUrl } = require("../src/utils/cloudinaryPublicId");

async function main() {
  const properties = await prisma.property.findMany({
    where: { images: { isEmpty: false } },
    select: { images: true, publishedById: true },
  });
  const users = await prisma.user.findMany({
    where: { avatar: { not: null } },
    select: { avatar: true, id: true },
  });

  const rows = [];
  for (const p of properties) {
    for (const url of p.images) {
      rows.push({ url, publicId: publicIdFromUrl(url), userId: p.publishedById });
    }
  }
  for (const u of users) {
    rows.push({ url: u.avatar, publicId: publicIdFromUrl(u.avatar), userId: u.id });
  }

  const { count } = await prisma.uploadedImage.createMany({ data: rows, skipDuplicates: true });
  console.log(`✅ Backfill listo: ${count} imágenes registradas (de ${rows.length} candidatas).`);
}

main()
  .catch((err) => { console.error("❌ Backfill falló:", err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
