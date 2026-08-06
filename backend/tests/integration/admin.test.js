const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function createAdmin() {
  const email = "admin-pagination@domify.test";
  const password = "claveAdmin123";
  const registerRes = await request(app).post("/api/auth/register").send({ name: "Admin", email, password });
  await prisma.user.update({ where: { id: registerRes.body.user.id }, data: { role: "ADMIN" } });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password });
  return loginRes.body.token;
}

describe("GET /api/admin/users", () => {
  it("rechaza a un usuario que no es ADMIN (403)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Cliente", email: "cliente-admin-test@domify.test", password: "clave12345",
    });

    const listRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${res.body.token}`);

    expect(listRes.status).toBe(403);
  });

  it("un limit absurdamente grande no rompe la query — responde 200 y clampea a 100", async () => {
    const adminToken = await createAdmin();

    const res = await request(app)
      .get("/api/admin/users?limit=999999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(100);
    // Con pocos usuarios en la DB de test, totalPages tiene que dar 1 —
    // si el limit no estuviera clampeado, este número sería el mismo por
    // casualidad (poca data), por eso el test unitario de clampPagination
    // es el que prueba el techo de 100 de forma directa.
    expect(res.body.totalPages).toBe(1);
  });
});
