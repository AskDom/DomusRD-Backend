const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

async function registerVendedor(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Vendedor Test", email, password: "clave123", role: "VENDEDOR",
  });
  return { token: res.body.token, user: res.body.user };
}

async function registerAgente(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Agente Test", email, password: "clave123", role: "AGENTE",
  });
  return { token: res.body.token, user: res.body.user };
}

async function registerCliente(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Cliente Test", email, password: "clave123",
  });
  return { token: res.body.token, user: res.body.user };
}

// register() no deja auto-asignarse ADMIN — promovemos por afuera y
// logueamos de nuevo para que el JWT nuevo lleve el rol actualizado.
async function registerAdmin(email) {
  const cliente = await registerCliente(email);
  await prisma.user.update({ where: { id: cliente.user.id }, data: { role: "ADMIN" } });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password: "clave123" });
  return { token: loginRes.body.token, user: loginRes.body.user };
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

async function createProperty(token, overrides = {}) {
  const res = await request(app)
    .post("/api/properties")
    .set("Authorization", `Bearer ${token}`)
    .send(samplePropertyPayload(overrides));
  return res.body.property;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("PATCH /api/admin/users/:id/verify", () => {
  it("rechaza a un no-ADMIN (403)", async () => {
    const agente  = await registerAgente("agent-v@domify.test");
    const cliente = await registerCliente("attacker-v@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${agente.user.id}/verify`)
      .set("Authorization", `Bearer ${cliente.token}`)
      .send({ verified: true });

    expect(res.status).toBe(403);
    const untouched = await prisma.user.findUnique({ where: { id: agente.user.id } });
    expect(untouched.verified).toBe(false);
  });

  it("un ADMIN verifica a un agente y registra verifiedAt", async () => {
    const admin  = await registerAdmin("admin-v@domify.test");
    const agente = await registerAgente("agent-v2@domify.test");

    const res = await request(app)
      .patch(`/api/admin/users/${agente.user.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: true });

    expect(res.status).toBe(200);
    expect(res.body.user.verified).toBe(true);
    expect(res.body.user.verifiedAt).not.toBeNull();
  });

  it("al quitar la verificación, verifiedAt vuelve a null", async () => {
    const admin  = await registerAdmin("admin-v3@domify.test");
    const agente = await registerAgente("agent-v3@domify.test");
    await prisma.user.update({ where: { id: agente.user.id }, data: { verified: true, verifiedAt: new Date() } });

    const res = await request(app)
      .patch(`/api/admin/users/${agente.user.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: false });

    expect(res.status).toBe(200);
    expect(res.body.user.verified).toBe(false);
    expect(res.body.user.verifiedAt).toBeNull();
  });
});

describe("PATCH /api/admin/properties/:id/verify (verifiedAt)", () => {
  it("guarda verifiedAt al verificar y lo limpia al desverificar", async () => {
    const admin = await registerAdmin("admin-pv@domify.test");
    const owner = await registerVendedor("owner-pv@domify.test");
    const property = await createProperty(owner.token);

    const verifyRes = await request(app)
      .patch(`/api/admin/properties/${property.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: true });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.property.verified).toBe(true);
    expect(verifyRes.body.property.verifiedAt).not.toBeNull();

    const unverifyRes = await request(app)
      .patch(`/api/admin/properties/${property.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: false });

    expect(unverifyRes.status).toBe(200);
    expect(unverifyRes.body.property.verified).toBe(false);
    expect(unverifyRes.body.property.verifiedAt).toBeNull();
  });
});

describe("Sello de agente verificado en el listado", () => {
  it("el listado público expone verified del publicador sin su email", async () => {
    const admin  = await registerAdmin("admin-badge@domify.test");
    const owner  = await registerVendedor("owner-badge@domify.test");
    const property = await createProperty(owner.token);

    await request(app)
      .patch(`/api/admin/users/${owner.user.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: true });

    const res = await request(app).get("/api/properties");
    const [prop] = res.body.properties;
    expect(prop.id).toBe(property.id);
    expect(prop.publishedBy.verified).toBe(true);
    expect(prop.publishedBy.email).toBeUndefined();
  });

  it("GET /api/users/:id incluye verified en el perfil público", async () => {
    const admin = await registerAdmin("admin-profile@domify.test");
    const agent = await registerAgente("agent-profile@domify.test");
    await request(app)
      .patch(`/api/admin/users/${agent.user.id}/verify`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ verified: true });

    const res = await request(app).get(`/api/users/${agent.user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.user.verified).toBe(true);
  });
});

describe("videoUrl / virtualTourUrl", () => {
  it("crea una propiedad con video y tour", async () => {
    const owner = await registerVendedor("owner-media@domify.test");

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(samplePropertyPayload({
        videoUrl: "https://www.youtube.com/watch?v=abc123",
        virtualTourUrl: "https://my.matterport.com/show/?m=abc123",
      }));

    expect(res.status).toBe(201);
    expect(res.body.property.videoUrl).toBe("https://www.youtube.com/watch?v=abc123");
    expect(res.body.property.virtualTourUrl).toBe("https://my.matterport.com/show/?m=abc123");
  });

  it("rechaza URLs peligrosas (javascript:) al crear (400)", async () => {
    const owner = await registerVendedor("owner-media2@domify.test");

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(samplePropertyPayload({ videoUrl: "javascript:alert(1)" }));

    expect(res.status).toBe(400);
  });

  it("permite actualizar el video después de publicar", async () => {
    const owner = await registerVendedor("owner-media3@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .put(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ videoUrl: "https://vimeo.com/123456", virtualTourUrl: "" });

    expect(res.status).toBe(200);
    expect(res.body.property.videoUrl).toBe("https://vimeo.com/123456");
    expect(res.body.property.virtualTourUrl).toBeNull();
  });
});

describe("GET /api/rates", () => {
  it("devuelve la tasa USD→DOP públicamente", async () => {
    const res = await request(app).get("/api/rates");
    expect(res.status).toBe(200);
    expect(typeof res.body.usdToDop).toBe("number");
    expect(res.body.usdToDop).toBeGreaterThan(0);
    expect(res.body.updatedAt).toBeDefined();
  });
});
