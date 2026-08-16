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
    const { token } = await registerCliente("cliente@domify.test");

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(samplePropertyPayload());

    expect(res.status).toBe(403);
  });

  it("rechaza al VENDEDOR que ya publicó 3 propiedades (403), llame directo al endpoint o no", async () => {
    const { token } = await registerVendedor("limite@domify.test");

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${token}`)
        .send(samplePropertyPayload({ title: `Propiedad ${i}` }));
      expect(res.status).toBe(201);
    }

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(samplePropertyPayload({ title: "Cuarta propiedad" }));

    expect(res.status).toBe(403);
  });

  it("no deja pasar más de 3 aunque lleguen en paralelo (TOCTOU)", async () => {
    const { token } = await registerVendedor("concurrencia@domify.test");

    const requests = Array.from({ length: 6 }, (_, i) =>
      request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${token}`)
        .send(samplePropertyPayload({ title: `Concurrente ${i}` }))
    );
    const results = await Promise.all(requests);
    const created = results.filter((r) => r.status === 201).length;

    expect(created).toBeLessThanOrEqual(3);
  });

  it("rechaza al AGENTE que ya publicó 10 propiedades (403)", async () => {
    const { token } = await registerAgente("agente-limite@domify.test");

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${token}`)
        .send(samplePropertyPayload({ title: `Propiedad de agente ${i}` }));
      expect(res.status).toBe(201);
    }

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${token}`)
      .send(samplePropertyPayload({ title: "Undécima propiedad del agente" }));

    expect(res.status).toBe(403);
  });

  it("crea la propiedad a nombre del usuario autenticado, aunque el body traiga otro userId", async () => {
    const { token, user } = await registerVendedor("vendedor@domify.test");
    const other = await registerVendedor("otro-vendedor@domify.test");

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
    const owner = await registerVendedor("owner@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .put(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ price: 175000 });

    expect(res.status).toBe(200);
    expect(res.body.property.price).toBe(175000);
  });

  it("un vendedor NO puede actualizar la propiedad de otro vendedor (403)", async () => {
    const owner   = await registerVendedor("owner2@domify.test");
    const attacker = await registerVendedor("attacker@domify.test");
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
    const owner    = await registerVendedor("owner3@domify.test");
    const attacker = await registerVendedor("attacker3@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .delete(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${attacker.token}`);

    expect(res.status).toBe(403);

    const stillThere = await prisma.property.findUnique({ where: { id: property.id } });
    expect(stillThere).not.toBeNull();
  });

  it("el dueño puede borrar su propia propiedad", async () => {
    const owner = await registerVendedor("owner4@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .delete(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    const gone = await prisma.property.findUnique({ where: { id: property.id } });
    expect(gone).toBeNull();
  });

  // register() no deja auto-asignarse ADMIN — promovemos por afuera y
  // logueamos de nuevo para que el JWT nuevo lleve el rol actualizado
  // (el rol de un JWT ya emitido no se relee en cada request).
  async function registerAdmin(email) {
    const cliente = await registerCliente(email);
    await prisma.user.update({ where: { id: cliente.user.id }, data: { role: "ADMIN" } });
    const loginRes = await request(app).post("/api/auth/login").send({ email, password: "clave123" });
    return { token: loginRes.body.token, user: loginRes.body.user };
  }

  it("un ADMIN sí puede actualizar la propiedad de otro usuario (moderación)", async () => {
    const owner = await registerVendedor("owner5@domify.test");
    const admin = await registerAdmin("admin5@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .put(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ price: 1 });

    expect(res.status).toBe(200);
    expect(res.body.property.price).toBe(1);
  });

  it("un ADMIN sí puede borrar la propiedad de otro usuario (moderación)", async () => {
    const owner = await registerVendedor("owner6@domify.test");
    const admin = await registerAdmin("admin6@domify.test");
    const property = await createProperty(owner.token);

    const res = await request(app)
      .delete(`/api/properties/${property.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const gone = await prisma.property.findUnique({ where: { id: property.id } });
    expect(gone).toBeNull();
  });
});

describe("GET /api/properties", () => {
  it("lista propiedades públicamente, sin autenticación", async () => {
    const owner = await registerVendedor("lister@domify.test");
    await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(samplePropertyPayload());

    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body.properties.length).toBe(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it("no expone el email del publicador en el listado público (privacidad)", async () => {
    const owner = await registerVendedor("privacy-owner@domify.test");
    await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(samplePropertyPayload());

    const res = await request(app).get("/api/properties");
    const [prop] = res.body.properties;

    expect(prop.publishedBy).toBeDefined();
    expect(prop.publishedBy.name).toBe("Vendedor Test");
    expect(prop.publishedBy.email).toBeUndefined();
  });

  describe("filtro ?ids=", () => {
    it("devuelve solo las propiedades cuyos IDs se piden, sin paginar", async () => {
      const owner = await registerVendedor("ids-owner@domify.test");
      const a = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload({ title: "Propiedad A ids" }));
      await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload({ title: "Propiedad B ids" }));
      const c = await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload({ title: "Propiedad C ids" }));

      const res = await request(app)
        .get("/api/properties")
        .query({ ids: [a.body.property.id, c.body.property.id].join(",") });

      expect(res.status).toBe(200);
      expect(res.body.properties.map((p) => p.title).sort()).toEqual([
        "Propiedad A ids",
        "Propiedad C ids",
      ]);
    });

    it("rechaza ids que no sean UUIDs válidos (400)", async () => {
      const res = await request(app).get("/api/properties").query({ ids: "no-soy-uuid,123" });
      expect(res.status).toBe(400);
    });
  });

  describe("filtro ?publishedBy=", () => {
    it("solo devuelve las propiedades de ese usuario", async () => {
      const owner   = await registerVendedor("pb-owner@domify.test");
      const other   = await registerVendedor("pb-other@domify.test");
      await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload({ title: "De owner" }));
      await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${other.token}`)
        .send(samplePropertyPayload({ title: "De other" }));

      const res = await request(app)
        .get("/api/properties")
        .query({ publishedBy: owner.user.id });

      expect(res.status).toBe(200);
      expect(res.body.properties).toHaveLength(1);
      expect(res.body.properties[0].title).toBe("De owner");
      expect(res.body.pagination.total).toBe(1);
    });

    it("rechaza publishedBy que no sea UUID (400)", async () => {
      const res = await request(app).get("/api/properties").query({ publishedBy: "no-soy-uuid" });
      expect(res.status).toBe(400);
    });
  });

  describe("filtro ?bbox=", () => {
    it("solo devuelve propiedades dentro del viewport", async () => {
      const owner = await registerVendedor("bbox-owner@domify.test");
      await request(app) // dentro del bbox (Piantini, Santo Domingo)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload({ title: "Dentro del bbox: Piantini" }));
      await request(app) // fuera del bbox (Punta Cana)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload({ title: "Fuera del bbox: Punta Cana", lat: 18.6825, lng: -68.4056 }));

      const res = await request(app).get("/api/properties").query({ bbox: "18.40,-70.05,18.55,-69.85" });

      expect(res.status).toBe(200);
      expect(res.body.properties.map((p) => p.title)).toEqual(["Dentro del bbox: Piantini"]);
    });

    it("ignora un bbox mal formado en vez de devolver error", async () => {
      const owner = await registerVendedor("bbox-malformed@domify.test");
      await request(app)
        .post("/api/properties")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(samplePropertyPayload());

      const res = await request(app).get("/api/properties").query({ bbox: "no-soy-un-bbox" });

      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
    });
  });
});

describe("Ubicación exacta requiere sesión", () => {
  async function createSampleProperty() {
    const owner = await registerVendedor("geo-owner@domify.test");
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
