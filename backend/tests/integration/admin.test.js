const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

async function registerCliente(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Cliente Test", email, password: "clave123",
  });
  return { token: res.body.token, user: res.body.user };
}

// register() no deja auto-asignarse ADMIN — promovemos por afuera y
// logueamos de nuevo para que el JWT nuevo lleve el rol actualizado
// (el rol de un JWT ya emitido no se relee en cada request).
async function registerAdmin(email) {
  const cliente = await registerCliente(email);
  await prisma.user.update({ where: { id: cliente.user.id }, data: { role: "ADMIN" } });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password: "clave123" });
  return { token: loginRes.body.token, user: loginRes.body.user };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Acceso al panel de administración", () => {
  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app).get("/api/admin/stats");
    expect(res.status).toBe(401);
  });

  it("rechaza a un usuario que no es ADMIN (403)", async () => {
    const cliente = await registerCliente("cliente@domify.test");
    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${cliente.token}`);
    expect(res.status).toBe(403);
  });

  it("un ADMIN sí puede ver las estadísticas", async () => {
    const admin = await registerAdmin("admin@domify.test");
    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalUsers");
  });
});

describe("PATCH /api/admin/users/:id/role", () => {
  it("un no-ADMIN no puede cambiar el rol de otro usuario (403)", async () => {
    const cliente = await registerCliente("attacker@domify.test");
    const victim  = await registerCliente("victim@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${victim.user.id}/role`)
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(403);
    const untouched = await prisma.user.findUnique({ where: { id: victim.user.id } });
    expect(untouched.role).toBe("CLIENTE");
  });

  it("un ADMIN puede cambiar el rol de otro usuario", async () => {
    const admin  = await registerAdmin("admin2@domify.test");
    const target = await registerCliente("target2@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${target.user.id}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "VENDEDOR" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("VENDEDOR");
  });

  it("un ADMIN no puede quitarse a sí mismo el rol de ADMIN (403)", async () => {
    const admin = await registerAdmin("admin3@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${admin.user.id}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "CLIENTE" });

    expect(res.status).toBe(403);
    const untouched = await prisma.user.findUnique({ where: { id: admin.user.id } });
    expect(untouched.role).toBe("ADMIN");
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("un ADMIN no puede eliminar su propia cuenta (403)", async () => {
    const admin = await registerAdmin("admin4@domify.test");

    const res = await request(app)
      .delete(`/api/admin/users/${admin.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(403);
    const stillThere = await prisma.user.findUnique({ where: { id: admin.user.id } });
    expect(stillThere).not.toBeNull();
  });

  it("un ADMIN puede eliminar la cuenta de otro usuario", async () => {
    const admin  = await registerAdmin("admin5@domify.test");
    const target = await registerCliente("target5@domify.test");

    const res = await request(app)
      .delete(`/api/admin/users/${target.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const gone = await prisma.user.findUnique({ where: { id: target.user.id } });
    expect(gone).toBeNull();
  });
});

describe("GET /api/admin/users — paginación y seguridad", () => {
  it("limit por defecto es 20", async () => {
    const admin = await registerAdmin("admin-limit-default@domify.test");
    const users = Array.from({ length: 25 }, (_, i) => ({
      id: require("crypto").randomUUID(),
      name: `User ${i}`,
      email: `default${i}@domify.test`,
      password: "hashed",
      role: "CLIENTE",
    }));
    await prisma.user.createMany({ data: users });

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(20);
    expect(res.body.total).toBe(26); // 25 bulk + 1 admin
    expect(res.body.totalPages).toBe(2); // ceil(26/20) = 2
  });

  it("limit greater than 100 is clamped to 100", async () => {
    const admin = await registerAdmin("admin-limit-clamp@domify.test");
    // Insertar 110 usuarios directamente en la DB (sin bcrypt) para no exceder timeout
    const users = Array.from({ length: 110 }, (_, i) => ({
      id: require("crypto").randomUUID(),
      name: `User ${i}`,
      email: `bulk${i}@domify.test`,
      password: "hashed",
      role: "CLIENTE",
    }));
    await prisma.user.createMany({ data: users });

    const res = await request(app)
      .get("/api/admin/users?limit=9999")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(100);
    expect(res.body.total).toBe(111); // 110 bulk + 1 admin
    expect(res.body.totalPages).toBe(2); // ceil(111/100) = 2
  });

  it("403 response does not leak user role (no tuRol field)", async () => {
    const cliente = await registerCliente("noadmin@domify.test");

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${cliente.token}`);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("tuRol");
    expect(res.body).toHaveProperty("error");
  });
});
