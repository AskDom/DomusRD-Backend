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

async function register(email, role = "CLIENTE") {
  const res = await request(app).post("/api/auth/register").send({
    name: "Test", email, password: "clave12345", role,
  });
  return { token: res.body.token, userId: res.body.user.id };
}

async function createProperty(ownerId) {
  return prisma.property.create({
    data: {
      title: "Casa de prueba", description: "Descripción de prueba bien larga",
      price: 100000, city: "Santo Domingo", lat: 18.5, lng: -69.9,
      images: [], publishedById: ownerId,
    },
  });
}

describe("GET /api/reviews/:propertyId", () => {
  it("es público y devuelve lista vacía + promedio 0 sin reseñas", async () => {
    const owner = await register("owner@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);

    const res = await request(app).get(`/api/reviews/${prop.id}`);
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
    expect(res.body.average).toBe(0);
  });

  it("calcula el promedio correctamente con varias reseñas", async () => {
    const owner = await register("owner2@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);
    const r1 = await register("r1@domify.test");
    const r2 = await register("r2@domify.test");

    await request(app).post(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${r1.token}`)
      .send({ rating: 5, comment: "Excelente lugar" });
    await request(app).post(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${r2.token}`)
      .send({ rating: 3, comment: "Está bien nomás" });

    const res = await request(app).get(`/api/reviews/${prop.id}`);
    expect(res.body.total).toBe(2);
    expect(res.body.average).toBe(4);
  });
});

describe("POST /api/reviews/:propertyId", () => {
  it("responde 401 sin token", async () => {
    const owner = await register("owner3@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);

    const res = await request(app).post(`/api/reviews/${prop.id}`).send({ rating: 5, comment: "Buena" });
    expect(res.status).toBe(401);
  });

  it("rechaza reseñar la propia propiedad (403)", async () => {
    const owner = await register("owner4@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);

    const res = await request(app).post(`/api/reviews/${prop.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ rating: 5, comment: "Mi propia casa" });
    expect(res.status).toBe(403);
  });

  it("un segundo POST del mismo usuario actualiza la reseña en vez de duplicarla", async () => {
    const owner = await register("owner5@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);
    const reviewer = await register("reviewer@domify.test");

    await request(app).post(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${reviewer.token}`)
      .send({ rating: 2, comment: "No me gustó" });
    const res = await request(app).post(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${reviewer.token}`)
      .send({ rating: 5, comment: "Reconsiderando, muy bueno" });

    expect(res.status).toBe(200);
    const all = await prisma.review.findMany({ where: { propertyId: prop.id } });
    expect(all).toHaveLength(1);
    expect(all[0].rating).toBe(5);
  });
});

describe("DELETE /api/reviews/:propertyId", () => {
  it("solo borra la reseña propia, no la de otro usuario para la misma propiedad", async () => {
    const owner = await register("owner6@domify.test", "VENDEDOR");
    const prop = await createProperty(owner.userId);
    const a = await register("a@domify.test");
    const b = await register("b@domify.test");

    await request(app).post(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${a.token}`)
      .send({ rating: 4, comment: "Reseña de A" });
    await request(app).post(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${b.token}`)
      .send({ rating: 2, comment: "Reseña de B" });

    const res = await request(app).delete(`/api/reviews/${prop.id}`).set("Authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(200);

    const remaining = await prisma.review.findMany({ where: { propertyId: prop.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(b.userId);
  });
});
