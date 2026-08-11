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

describe("POST /api/messages", () => {
  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app).post("/api/messages").send({
      toId: "00000000-0000-0000-0000-000000000000",
      propertyId: "00000000-0000-0000-0000-000000000000",
      text: "Hola",
    });
    expect(res.status).toBe(401);
  });

  it("crea el mensaje a nombre del emisor autenticado", async () => {
    const owner    = await registerVendedor("owner@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer@domify.test");

    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ toId: owner.user.id, propertyId: property.id, text: "¿Sigue disponible?" });

    expect(res.status).toBe(201);
    expect(res.body.message.fromId).toBe(buyer.user.id);
    expect(res.body.message.toId).toBe(owner.user.id);
  });

});

describe("GET /api/messages", () => {
  it("solo devuelve conversaciones donde el usuario participa", async () => {
    const owner    = await registerVendedor("owner3@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer3@domify.test");
    const stranger = await registerCliente("stranger3@domify.test");

    await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ toId: owner.user.id, propertyId: property.id, text: "¿Sigue disponible?" });

    const res = await request(app)
      .get("/api/messages")
      .set("Authorization", `Bearer ${stranger.token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(0);
  });
});

describe("PATCH /api/messages/:id/read", () => {
  it("solo el receptor puede marcar el mensaje como leído", async () => {
    const owner    = await registerVendedor("owner4@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer4@domify.test");
    const stranger = await registerCliente("stranger4@domify.test");

    const sent = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ toId: owner.user.id, propertyId: property.id, text: "¿Sigue disponible?" });
    const messageId = sent.body.message.id;

    // Ni el emisor ni un tercero pueden marcarlo como leído.
    await request(app)
      .patch(`/api/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${buyer.token}`);
    await request(app)
      .patch(`/api/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${stranger.token}`);

    let current = await prisma.message.findUnique({ where: { id: messageId } });
    expect(current.read).toBe(false);

    // El receptor real sí puede.
    const res = await request(app)
      .patch(`/api/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    current = await prisma.message.findUnique({ where: { id: messageId } });
    expect(current.read).toBe(true);
  });
});

describe("DELETE /api/messages/:id", () => {
  it("el emisor NO puede borrar un mensaje que envió (solo el receptor puede)", async () => {
    const owner    = await registerVendedor("owner5@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer5@domify.test");

    const sent = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ toId: owner.user.id, propertyId: property.id, text: "¿Sigue disponible?" });
    const messageId = sent.body.message.id;

    await request(app)
      .delete(`/api/messages/${messageId}`)
      .set("Authorization", `Bearer ${buyer.token}`);

    const stillThere = await prisma.message.findUnique({ where: { id: messageId } });
    expect(stillThere).not.toBeNull();
  });

  it("el receptor puede borrar el mensaje que recibió", async () => {
    const owner    = await registerVendedor("owner6@domify.test");
    const property = await createProperty(owner.token);
    const buyer    = await registerCliente("buyer6@domify.test");

    const sent = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ toId: owner.user.id, propertyId: property.id, text: "¿Sigue disponible?" });
    const messageId = sent.body.message.id;

    const res = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const gone = await prisma.message.findUnique({ where: { id: messageId } });
    expect(gone).toBeNull();
  });
});
