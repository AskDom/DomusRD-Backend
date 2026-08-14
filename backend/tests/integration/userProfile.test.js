const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

async function registerVendedor(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Vendedor Test", email, password: "clave123", role: "VENDEDOR",
  });
  return { token: res.body.token, user: res.body.user };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("GET /api/users/:id", () => {
  it("sin sesión, redondea lat/lng en vez de devolver la ubicación exacta", async () => {
    const { token, user } = await registerVendedor("vendedor@domify.test");
    await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Apartamento amplio en Piantini",
        description: "Descripción suficientemente larga para pasar la validación.",
        price: 150000, city: "Santo Domingo", lat: 18.465538, lng: -69.931278,
      });

    const res = await request(app).get(`/api/users/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body.properties).toHaveLength(1);
    expect(res.body.properties[0].lat).not.toBe(18.465538);
    expect(res.body.properties[0].lng).not.toBe(-69.931278);
    expect(res.body.properties[0].lat).toBeCloseTo(18.47, 1);
  });

  it("con sesión, devuelve la ubicación exacta", async () => {
    const { token, user } = await registerVendedor("vendedor2@domify.test");
    await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Apartamento amplio en Piantini",
        description: "Descripción suficientemente larga para pasar la validación.",
        price: 150000, city: "Santo Domingo", lat: 18.465538, lng: -69.931278,
      });

    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.properties[0].lat).toBe(18.465538);
    expect(res.body.properties[0].lng).toBe(-69.931278);
  });
});
