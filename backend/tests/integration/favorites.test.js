const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

async function registerVendedor(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Vendedor Test", email, password: "clave123", role: "VENDEDOR",
  });
  return { token: res.body.token, user: res.body.user };
}

async function registerCliente(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Cliente Test", email, password: "clave123",
  });
  return { token: res.body.token, user: res.body.user };
}

async function createProperty(token, overrides = {}) {
  const res = await request(app)
    .post("/api/properties")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Apartamento amplio en Piantini",
      description: "Descripción suficientemente larga para pasar la validación.",
      price: 150000,
      city: "Santo Domingo",
      lat: 18.4655,
      lng: -69.9313,
      ...overrides,
    });
  return res.body.property;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("POST /api/favorites/:propertyId", () => {
  it("rechaza sin autenticación (401)", async () => {
    const owner    = await registerVendedor("owner@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app).post(`/api/favorites/${property.id}`);
    expect(res.status).toBe(401);
  });

  it("agregar el mismo favorito dos veces no falla ni lo duplica", async () => {
    const owner    = await registerVendedor("owner2@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer2@domify.test");

    const first  = await request(app)
      .post(`/api/favorites/${property.id}`)
      .set("Authorization", `Bearer ${buyer.token}`);
    const second = await request(app)
      .post(`/api/favorites/${property.id}`)
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const all = await prisma.favorite.findMany({
      where: { userId: buyer.user.id, propertyId: property.id },
    });
    expect(all).toHaveLength(1);
  });

  it("devuelve 404 si la propiedad no existe (no un 500 por foreign key)", async () => {
    const buyer = await registerCliente("buyer404@domify.test");

    const res = await request(app)
      .post("/api/favorites/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(res.status).toBe(404);
  });

  it("rechaza un propertyId que no sea UUID (400)", async () => {
    const buyer = await registerCliente("buyer400@domify.test");

    const res = await request(app)
      .post("/api/favorites/no-soy-uuid")
      .set("Authorization", `Bearer ${buyer.token}`);

    expect(res.status).toBe(400);
  });
});

describe("Aislamiento de favoritos entre usuarios", () => {
  it("los favoritos de un usuario no se listan para otro", async () => {
    const owner    = await registerVendedor("owner3@domify.test");
    const property = await createProperty(owner.token);
    const buyerA   = await registerCliente("buyerA3@domify.test");
    const buyerB   = await registerCliente("buyerB3@domify.test");

    await request(app)
      .post(`/api/favorites/${property.id}`)
      .set("Authorization", `Bearer ${buyerA.token}`);

    const resB = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${buyerB.token}`);

    expect(resB.body.favorites).toHaveLength(0);
  });

  it("quitar un favorito no afecta el mismo propertyId marcado por otro usuario", async () => {
    const owner    = await registerVendedor("owner4@domify.test");
    const property = await createProperty(owner.token);
    const buyerA   = await registerCliente("buyerA4@domify.test");
    const buyerB   = await registerCliente("buyerB4@domify.test");

    await request(app)
      .post(`/api/favorites/${property.id}`)
      .set("Authorization", `Bearer ${buyerA.token}`);
    await request(app)
      .post(`/api/favorites/${property.id}`)
      .set("Authorization", `Bearer ${buyerB.token}`);

    await request(app)
      .delete(`/api/favorites/${property.id}`)
      .set("Authorization", `Bearer ${buyerA.token}`);

    const stillFavorited = await prisma.favorite.findFirst({
      where: { userId: buyerB.user.id, propertyId: property.id },
    });
    expect(stillFavorited).not.toBeNull();
  });
});
