const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

let _cedulaSeq = 0;
function nextCedula() {
  return String(++_cedulaSeq).padStart(11, '0');
}

async function registerVendedor(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Vendedor Test", email, password: "clave123", role: "VENDEDOR", cedula: nextCedula(),
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

describe("POST /api/reviews/:propertyId", () => {
  it("rechaza sin autenticación (401)", async () => {
    const owner    = await registerVendedor("owner@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .post(`/api/reviews/${property.id}`)
      .send({ rating: 5, comment: "Excelente lugar" });

    expect(res.status).toBe(401);
  });

  it("rechaza reseñar la propia propiedad (403)", async () => {
    const owner    = await registerVendedor("owner2@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .post(`/api/reviews/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ rating: 5, comment: "Mi propia casa es genial" });

    expect(res.status).toBe(403);
  });

  it("una segunda reseña del mismo usuario actualiza la anterior en vez de duplicarla", async () => {
    const owner    = await registerVendedor("owner3@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer3@domify.test");

    await request(app)
      .post(`/api/reviews/${property.id}`)
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ rating: 3, comment: "Está bien, nada más" });

    const res = await request(app)
      .post(`/api/reviews/${property.id}`)
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ rating: 5, comment: "Lo pensé mejor, es excelente" });

    expect(res.status).toBe(200);
    expect(res.body.review.rating).toBe(5);

    const all = await prisma.review.findMany({ where: { propertyId: property.id } });
    expect(all).toHaveLength(1);
  });
});

describe("DELETE /api/reviews/:propertyId", () => {
  it("borrar la propia reseña no toca la reseña de otro usuario sobre la misma propiedad", async () => {
    const owner    = await registerVendedor("owner4@domify.test");
    const property = await createProperty(owner.token);
    const buyerA   = await registerCliente("buyerA4@domify.test");
    const buyerB   = await registerCliente("buyerB4@domify.test");

    await request(app)
      .post(`/api/reviews/${property.id}`)
      .set("Authorization", `Bearer ${buyerA.token}`)
      .send({ rating: 4, comment: "Reseña de A sobre esta propiedad" });
    await request(app)
      .post(`/api/reviews/${property.id}`)
      .set("Authorization", `Bearer ${buyerB.token}`)
      .send({ rating: 2, comment: "Reseña de B sobre esta propiedad" });

    const res = await request(app)
      .delete(`/api/reviews/${property.id}`)
      .set("Authorization", `Bearer ${buyerA.token}`);
    expect(res.status).toBe(200);

    const remaining = await prisma.review.findMany({ where: { propertyId: property.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(buyerB.user.id);
  });
});
