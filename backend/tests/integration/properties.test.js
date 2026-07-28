const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

// Estos tests son sobre roles/IDOR en properties, no sobre verificación de
// correo — se marca verificado directo en la DB para no acoplar ambos temas.
async function registerVendedor(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Vendedor Test", email, password: "clave123", role: "VENDEDOR",
  });
  await prisma.user.update({ where: { id: res.body.user.id }, data: { emailVerified: true } });
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

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("POST /api/properties", () => {
  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app).post("/api/properties").send(samplePropertyPayload());
    expect(res.status).toBe(401);
  });

  it("rechaza a un CLIENTE, que no tiene permiso para publicar (403)", async () => {
    const { token } = await registerCliente("cliente@domusrd.test");

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(samplePropertyPayload());

    expect(res.status).toBe(403);
  });

  it("crea la propiedad a nombre del usuario autenticado, aunque el body traiga otro userId", async () => {
    const { token, user } = await registerVendedor("vendedor@domusrd.test");
    const other = await registerVendedor("otro-vendedor@domusrd.test");

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(samplePropertyPayload({ userId: other.user.id, publishedById: other.user.id }));

    expect(res.status).toBe(201);
    expect(res.body.property.publishedBy.id).toBe(user.id);
  });
});

describe("IDOR en PUT/DELETE /api/properties/:id", () => {
  async function createProperty(token) {
    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(samplePropertyPayload());
    return res.body.property;
  }

  it("el dueño puede actualizar su propia propiedad", async () => {
    const owner = await registerVendedor("owner@domusrd.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .put(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ price: 175000 });

    expect(res.status).toBe(200);
    expect(res.body.property.price).toBe(175000);
  });

  it("un vendedor NO puede actualizar la propiedad de otro vendedor (403)", async () => {
    const owner   = await registerVendedor("owner2@domusrd.test");
    const attacker = await registerVendedor("attacker@domusrd.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .put(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({ price: 1 });

    expect(res.status).toBe(403);

    const untouched = await prisma.property.findUnique({ where: { id: property.id } });
    expect(untouched.price).toBe(150000);
  });

  it("un vendedor NO puede borrar la propiedad de otro vendedor (403)", async () => {
    const owner    = await registerVendedor("owner3@domusrd.test");
    const attacker = await registerVendedor("attacker3@domusrd.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .delete(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${attacker.token}`);

    expect(res.status).toBe(403);

    const stillThere = await prisma.property.findUnique({ where: { id: property.id } });
    expect(stillThere).not.toBeNull();
  });

  it("el dueño puede borrar su propia propiedad", async () => {
    const owner = await registerVendedor("owner4@domusrd.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .delete(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    const gone = await prisma.property.findUnique({ where: { id: property.id } });
    expect(gone).toBeNull();
  });
});

describe("GET /api/properties", () => {
  it("lista propiedades públicamente, sin autenticación", async () => {
    const owner = await registerVendedor("lister@domusrd.test");
    await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(samplePropertyPayload());

    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body.properties.length).toBe(1);
    expect(res.body.pagination.total).toBe(1);
  });
});

describe("Ubicación exacta requiere sesión", () => {
  async function createSampleProperty() {
    const owner = await registerVendedor("geo-owner@domusrd.test");
    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(samplePropertyPayload());
    return { owner, property: res.body.property };
  }

  it("GET /api/properties sin sesión redondea lat/lng a una zona aproximada", async () => {
    await createSampleProperty();

    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    const [prop] = res.body.properties;
    expect(prop.lat).toBe(18.47);
    expect(prop.lng).toBe(-69.93);
    expect(prop.lat).not.toBe(18.4655);
  });

  it("GET /api/properties con sesión devuelve lat/lng exactos", async () => {
    const { owner } = await createSampleProperty();

    const res = await request(app)
      .get("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`);

    const [prop] = res.body.properties;
    expect(prop.lat).toBe(18.4655);
    expect(prop.lng).toBe(-69.9313);
  });

  it("GET /api/properties/:id sin sesión no incluye lat ni lng", async () => {
    const { property } = await createSampleProperty();

    const res = await request(app).get(`/api/properties/${property.id}`);

    expect(res.status).toBe(200);
    expect(res.body.lat).toBeUndefined();
    expect(res.body.lng).toBeUndefined();
  });

  it("GET /api/properties/:id con sesión sí incluye lat/lng exactos", async () => {
    const { owner, property } = await createSampleProperty();

    const res = await request(app)
      .get(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.body.lat).toBe(18.4655);
    expect(res.body.lng).toBe(-69.9313);
  });
});
