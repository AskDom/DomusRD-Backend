const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

async function registerCliente(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Cliente Test", email, password: "clave123",
  });
  return { token: res.body.token, user: res.body.user };
}

function sampleSearchPayload(overrides = {}) {
  return { name: "Apartamentos en Piantini", filters: { city: "Santo Domingo" }, ...overrides };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("POST /api/saved-searches", () => {
  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app).post("/api/saved-searches").send(sampleSearchPayload());
    expect(res.status).toBe(401);
  });

  it("quita etiquetas HTML del nombre antes de guardarlo", async () => {
    const { token } = await registerCliente("xss@domify.test");
    const res = await request(app)
      .post("/api/saved-searches")
      .set("Authorization", `Bearer ${token}`)
      .send(sampleSearchPayload({ name: "<script>alert(1)</script>Mi búsqueda" }));

    expect(res.status).toBe(201);
    // El sanitizador descarta el elemento <script> completo (tag y
    // contenido), no solo el tag — así "alert(1)" tampoco sobrevive.
    expect(res.body.search.name).toBe("Mi búsqueda");
  });

  it("no altera texto plano con < > & que no forma etiquetas reales", async () => {
    const { token } = await registerCliente("plano@domify.test");
    const res = await request(app)
      .post("/api/saved-searches")
      .set("Authorization", `Bearer ${token}`)
      .send(sampleSearchPayload({ name: "3 < 4 dormitorios & 2 baños" }));

    expect(res.status).toBe(201);
    expect(res.body.search.name).toBe("3 < 4 dormitorios & 2 baños");
  });

  it("quita una etiqueta sin cerrar en vez de guardarla tal cual", async () => {
    const { token } = await registerCliente("sincerrar@domify.test");
    const res = await request(app)
      .post("/api/saved-searches")
      .set("Authorization", `Bearer ${token}`)
      .send(sampleSearchPayload({ name: "<img src=x onerror=alert(1)//" }));

    expect(res.status).toBe(201);
    expect(res.body.search.name).toBe("");
  });

  it("rechaza al usuario que ya tiene 20 búsquedas guardadas (403)", async () => {
    const { token, user } = await registerCliente("limite@domify.test");
    await prisma.savedSearch.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        userId: user.id, name: `Búsqueda ${i}`, filters: { city: "Santiago" },
      })),
    });

    const res = await request(app)
      .post("/api/saved-searches")
      .set("Authorization", `Bearer ${token}`)
      .send(sampleSearchPayload());

    expect(res.status).toBe(403);
  });

  it("no deja pasar más de 20 aunque lleguen en paralelo (TOCTOU)", async () => {
    const { token } = await registerCliente("concurrencia@domify.test");

    const requests = Array.from({ length: 25 }, (_, i) =>
      request(app)
        .post("/api/saved-searches")
        .set("Authorization", `Bearer ${token}`)
        .send(sampleSearchPayload({ name: `Concurrente ${i}` }))
    );
    const results = await Promise.all(requests);
    const created = results.filter((r) => r.status === 201).length;

    expect(created).toBeLessThanOrEqual(20);
  });
});
