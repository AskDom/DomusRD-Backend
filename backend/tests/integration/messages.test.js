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

async function register(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Test", email, password: "clave12345",
  });
  return { token: res.body.token, userId: res.body.user.id };
}

async function createProperty(ownerId) {
  return prisma.property.create({
    data: {
      title: "Casa", description: "Descripción de prueba bien larga",
      price: 100000, city: "Santo Domingo", lat: 18.5, lng: -69.9,
      images: [], publishedById: ownerId,
    },
  });
}

describe("GET /api/messages", () => {
  it("responde 401 sin token", async () => {
    const res = await request(app).get("/api/messages");
    expect(res.status).toBe(401);
  });

  it("solo devuelve conversaciones donde el usuario participa", async () => {
    const owner = await register("owner@domify.test");
    const prop = await createProperty(owner.userId);
    const a = await register("a@domify.test");
    const b = await register("b@domify.test");

    await request(app).post("/api/messages").set("Authorization", `Bearer ${a.token}`)
      .send({ toId: owner.userId, propertyId: prop.id, text: "Hola, me interesa" });
    await request(app).post("/api/messages").set("Authorization", `Bearer ${b.token}`)
      .send({ toId: owner.userId, propertyId: prop.id, text: "Otra consulta distinta" });

    const resA = await request(app).get("/api/messages").set("Authorization", `Bearer ${a.token}`);
    expect(resA.body.messages).toHaveLength(1);
    expect(resA.body.messages[0].text).toBe("Hola, me interesa");
  });
});

describe("POST /api/messages", () => {
  it("ignora un fromId falsificado en el body — siempre usa el usuario autenticado", async () => {
    const owner = await register("owner2@domify.test");
    const prop = await createProperty(owner.userId);
    const attacker = await register("attacker@domify.test");
    const victim = await register("victim@domify.test");

    const res = await request(app).post("/api/messages").set("Authorization", `Bearer ${attacker.token}`)
      .send({ toId: owner.userId, propertyId: prop.id, text: "Mensaje normal", fromId: victim.userId });

    expect(res.status).toBe(201);
    expect(res.body.message.fromId).toBe(attacker.userId);
  });
});

describe("PATCH /api/messages/:id/read", () => {
  it("solo el destinatario puede marcarlo como leído — el remitente no puede", async () => {
    const owner = await register("owner3@domify.test");
    const prop = await createProperty(owner.userId);
    const sender = await register("sender@domify.test");

    const sendRes = await request(app).post("/api/messages").set("Authorization", `Bearer ${sender.token}`)
      .send({ toId: owner.userId, propertyId: prop.id, text: "Consulta" });
    const messageId = sendRes.body.message.id;

    await request(app).patch(`/api/messages/${messageId}/read`).set("Authorization", `Bearer ${sender.token}`);
    let msg = await prisma.message.findUnique({ where: { id: messageId } });
    expect(msg.read).toBe(false);

    await request(app).patch(`/api/messages/${messageId}/read`).set("Authorization", `Bearer ${owner.token}`);
    msg = await prisma.message.findUnique({ where: { id: messageId } });
    expect(msg.read).toBe(true);
  });
});

describe("DELETE /api/messages/:id", () => {
  it("solo el destinatario puede eliminarlo — el remitente no puede borrar la copia del otro", async () => {
    const owner = await register("owner4@domify.test");
    const prop = await createProperty(owner.userId);
    const sender = await register("sender2@domify.test");

    const sendRes = await request(app).post("/api/messages").set("Authorization", `Bearer ${sender.token}`)
      .send({ toId: owner.userId, propertyId: prop.id, text: "Consulta 2" });
    const messageId = sendRes.body.message.id;

    await request(app).delete(`/api/messages/${messageId}`).set("Authorization", `Bearer ${sender.token}`);
    let msg = await prisma.message.findUnique({ where: { id: messageId } });
    expect(msg).not.toBeNull();

    await request(app).delete(`/api/messages/${messageId}`).set("Authorization", `Bearer ${owner.token}`);
    msg = await prisma.message.findUnique({ where: { id: messageId } });
    expect(msg).toBeNull();
  });
});
