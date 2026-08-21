const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const COUNT = parseInt(process.argv[2]) || 500;

async function main() {
  const hashed = await bcrypt.hash("123456", 10);
  const existing = await prisma.user.count({ where: { email: { startsWith: "lt-user-" } } });
  console.log(`Usuarios lt-user existentes: ${existing}`);
  const batch = [];
  for (let i = existing; i < COUNT; i++) {
    batch.push({
      name: `Load User ${i}`,
      email: `lt-user-${i}@loadtest.local`,
      password: hashed,
      role: i % 20 === 0 ? "VENDEDOR" : "CLIENTE",
    });
  }
  for (let i = 0; i < batch.length; i += 500) {
    await prisma.user.createMany({ data: batch.slice(i, i + 500), skipDuplicates: true });
    process.stdout.write(`\r${Math.min(i + 500, batch.length)}/${batch.length}`);
  }
  const total = await prisma.user.count({ where: { email: { startsWith: "lt-user-" } } });
  console.log(`\nTotal usuarios de carga: ${total} (password: 123456)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
