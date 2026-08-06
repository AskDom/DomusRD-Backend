// Cobertura de admin.controller.js más allá de lo que ya cubre
// admin.test.js (403 para no-admin + clamp de paginación, en otro PR):
// cambio de rol, borrado de usuarios/propiedades, verificación y stats.
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

async function register(email, role = "CLIENTE") {
  const res = await request(app).post("/api/auth/register").send({
    name: "Test", email, password: "clave12345", role,
  });
  return { token: res.body.token, userId: res.body.user.id };
}

async function createAdmin(email = "admin@domify.test") {
  const admin = await register(email, "CLIENTE");
  await prisma.user.update({ where: { id: admin.userId }, data: { role: "ADMIN" } });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password: "clave12345" });
  return { token: loginRes.body.token, userId: admin.userId };
}

async function createProperty(ownerId, overrides = {}) {
  return prisma.property.create({
    data: {
      title: "Casa", description: "Descripción de prueba bien larga",
      price: 100000, city: "Santo Domingo", lat: 18.5, lng: -69.9,
      images: [], publishedById: ownerId, ...overrides,
    },
  });
}

describe("PATCH /api/admin/users/:id/role", () => {
  it("cambia el rol de otro usuario", async () => {
    const admin = await createAdmin();
    const target = await register("target@domify.test", "VENDEDOR");

    const res = await request(app)
      .patch(`/api/admin/users/${target.userId}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "AGENTE" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("AGENTE");
  });

  it("rechaza un rol inválido (400)", async () => {
    const admin = await createAdmin();
    const target = await register("target2@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${target.userId}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "SUPERUSUARIO" });

    expect(res.status).toBe(400);
  });

  it("un admin no puede quitarse su propio rol de ADMIN (403)", async () => {
    const admin = await createAdmin("self-admin@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${admin.userId}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "CLIENTE" });

    expect(res.status).toBe(403);
    const user = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(user.role).toBe("ADMIN");
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("elimina a otro usuario", async () => {
    const admin = await createAdmin();
    const target = await register("borrar@domify.test");

    const res = await request(app)
      .delete(`/api/admin/users/${target.userId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(user).toBeNull();
  });

  it("un admin no puede eliminar su propia cuenta (403)", async () => {
    const admin = await createAdmin("no-suicidio@domify.test");

    const res = await request(app)
      .delete(`/api/admin/users/${admin.userId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(403);
    const user = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(user).not.toBeNull();
  });
});

describe("PATCH /api/admin/properties/:id/verify", () => {
  it("marca una propiedad como verificada", async () => {
    const admin = await createAdmin();
    const owner = await register("owner@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);

    const res = await request(app)
      .patch(`/api/admin/properties/${prop.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: true });

    expect(res.status).toBe(200);
    expect(res.body.property.verified).toBe(true);
  });
});

describe("DELETE /api/admin/properties/:id", () => {
  it("elimina una propiedad de cualquier usuario", async () => {
    const admin = await createAdmin();
    const owner = await register("owner2@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);

    const res = await request(app)
      .delete(`/api/admin/properties/${prop.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const found = await prisma.property.findUnique({ where: { id: prop.id } });
    expect(found).toBeNull();
  });
});

describe("GET /api/admin/stats", () => {
  it("devuelve los conteos generales", async () => {
    const admin = await createAdmin();
    const owner = await register("owner3@domify.test", "VENDEDOR");
    await createProperty(owner.userId);

    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalProperties).toBeGreaterThanOrEqual(1);
    expect(res.body.pendingVerification).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.usersByRole)).toBe(true);
  });
});
