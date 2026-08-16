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

function samplePropertyPayload(overrides = {}) {
  return {
    title: "Apartamento amplio en Piantini",
    description: "Descripción suficientemente larga para pasar la validación.",
    price: 150000,
    city: "Santo Domingo",
    lat: 18.4655,
    lng: -69.9313,
    ...overrides,
  };
}

async function createProperty(token) {
  const res = await request(app)
    .post("/api/properties")
    .set("Authorization", `Bearer ${token}`)
    .send(samplePropertyPayload());
  return res.body.property;
}

const futureDate = (daysFromNow = 2) => new Date(Date.now() + daysFromNow * 86400000).toISOString();
const pastDate   = () => new Date(Date.now() - 86400000).toISOString();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("POST /api/visits", () => {
  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app).post("/api/visits").send({
      propertyId: "00000000-0000-0000-0000-000000000000",
      scheduledAt: futureDate(),
    });
    expect(res.status).toBe(401);
  });

  it("rechaza si falta la fecha (400)", async () => {
    const owner   = await registerVendedor("visit-owner@domify.test");
    const cliente = await registerCliente("visit-cliente@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ propertyId: property.id, message: "Quiero verla" });

    expect(res.status).toBe(400);
  });

  it("rechaza una fecha en el pasado (400)", async () => {
    const owner   = await registerVendedor("visit-owner2@domify.test");
    const cliente = await registerCliente("visit-cliente2@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ propertyId: property.id, scheduledAt: pastDate() });

    expect(res.status).toBe(400);
  });

  it("el dueño no puede agendar una visita a su propia propiedad (403)", async () => {
    const owner = await registerVendedor("visit-owner3@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ propertyId: property.id, scheduledAt: futureDate() });

    expect(res.status).toBe(403);
  });

  it("crea la visita como PENDIENTE y notifica al dueño (201)", async () => {
    const owner   = await registerVendedor("visit-owner4@domify.test");
    const cliente = await registerCliente("visit-cliente4@domify.test");
    const property = await createProperty(owner.token);
    const scheduledAt = futureDate();

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ propertyId: property.id, scheduledAt, message: "¿Podría ser el sábado? Gracias." });

    expect(res.status).toBe(201);
    expect(res.body.visit.status).toBe("PENDIENTE");
    expect(res.body.visit.propertyId).toBe(property.id);
    expect(res.body.visit.userId).toBe(cliente.user.id);

    const notif = await prisma.notification.findMany({ where: { userId: owner.user.id } });
    expect(notif).toHaveLength(1);
    expect(notif[0].message).toContain("quiere visitar");

    const msgs = await prisma.message.findMany({
      where: { fromId: cliente.user.id, toId: owner.user.id },
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].visitId).toBe(res.body.visit.id);
    expect(msgs[0].propertyId).toBe(property.id);
    expect(msgs[0].text).toContain("Solicitud de visita");
  });

  it("rechaza una propiedad inexistente (404)", async () => {
    const cliente = await registerCliente("visit-cliente5@domify.test");
    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({
        propertyId: "00000000-0000-0000-0000-000000000000",
        scheduledAt: futureDate(),
      });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/visits/:id/status", () => {
  async function createPendingVisit() {
    const owner   = await registerVendedor("visit-ownerX@domify.test");
    const cliente = await registerCliente("visit-clienteX@domify.test");
    const property = await createProperty(owner.token);
    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ propertyId: property.id, scheduledAt: futureDate() });
    return { owner, cliente, visit: res.body.visit, property };
  }

  it("el dueño de la propiedad puede confirmar la visita (200)", async () => {
    const { owner, visit } = await createPendingVisit();

    const res = await request(app)
      .patch(`/api/visits/${visit.id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "CONFIRMADA" });

    expect(res.status).toBe(200);
    expect(res.body.visit.status).toBe("CONFIRMADA");
  });

  it("al confirmar, se notifica al interesado", async () => {
    const { owner, cliente, visit } = await createPendingVisit();

    await request(app)
      .patch(`/api/visits/${visit.id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "CONFIRMADA" });

    const notif = await prisma.notification.findMany({ where: { userId: cliente.user.id } });
    expect(notif).toHaveLength(1);
    expect(notif[0].message).toContain("fue confirmada");

    const msgs = await prisma.message.findMany({
      where: { fromId: owner.user.id, toId: cliente.user.id },
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].visitId).toBe(visit.id);
    expect(msgs[0].text).toContain("fue confirmada");
  });

  it("un tercero (ni dueño ni interesado) no puede cambiar el estado (403)", async () => {
    const { visit } = await createPendingVisit();
    const stranger = await registerCliente("visit-stranger@domify.test");

    const res = await request(app)
      .patch(`/api/visits/${visit.id}/status`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ status: "CONFIRMADA" });

    expect(res.status).toBe(403);
  });

  it("el interesado puede cancelar su solicitud pendiente (200)", async () => {
    const { cliente, visit } = await createPendingVisit();

    const res = await request(app)
      .patch(`/api/visits/${visit.id}/status`)
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ status: "CANCELADA" });

    expect(res.status).toBe(200);
    expect(res.body.visit.status).toBe("CANCELADA");
  });

  it("el interesado no puede confirmar su propia solicitud (403)", async () => {
    const { cliente, visit } = await createPendingVisit();

    const res = await request(app)
      .patch(`/api/visits/${visit.id}/status`)
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ status: "CONFIRMADA" });

    expect(res.status).toBe(403);
    const untouched = await prisma.visit.findUnique({ where: { id: visit.id } });
    expect(untouched.status).toBe("PENDIENTE");
  });

  it("rechaza un estado inválido (400)", async () => {
    const { owner, visit } = await createPendingVisit();

    const res = await request(app)
      .patch(`/api/visits/${visit.id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "BAILANDO" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/visits/mine y /api/visits/received", () => {
  it("el interesado ve sus solicitudes", async () => {
    const owner   = await registerVendedor("visit-ownerY@domify.test");
    const cliente = await registerCliente("visit-clienteY@domify.test");
    const property = await createProperty(owner.token);
    await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ propertyId: property.id, scheduledAt: futureDate() });

    const res = await request(app)
      .get("/api/visits/mine")
      .set("Authorization", `Bearer ${cliente.token}`);

    expect(res.status).toBe(200);
    expect(res.body.visits).toHaveLength(1);
    expect(res.body.visits[0].property.id).toBe(property.id);
  });

  it("un CLIENTE no puede ver las visitas recibidas (403)", async () => {
    const cliente = await registerCliente("visit-clienteZ@domify.test");
    const res = await request(app)
      .get("/api/visits/received")
      .set("Authorization", `Bearer ${cliente.token}`);
    expect(res.status).toBe(403);
  });

  it("el dueño ve las visitas a sus propiedades", async () => {
    const owner   = await registerVendedor("visit-ownerW@domify.test");
    const cliente = await registerCliente("visit-clienteW@domify.test");
    const property = await createProperty(owner.token);
    await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ propertyId: property.id, scheduledAt: futureDate() });

    const res = await request(app)
      .get("/api/visits/received")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.visits).toHaveLength(1);
    expect(res.body.visits[0].user.name).toBe("Cliente Test");
    expect(res.body.visits[0].property.id).toBe(property.id);
  });
});
