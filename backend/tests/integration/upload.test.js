// upload.controller.js usa multer-storage-cloudinary, que pega contra
// Cloudinary de verdad — se mockea todo el módulo para no depender de
// credenciales reales ni de red. upload/uploadAvatar quedan como multer
// con memoryStorage (así el multipart real se sigue parseando) y
// cloudinary.uploader.destroy queda como jest.fn().
jest.mock("../../src/config/cloudinary", () => {
  const multer = require("multer");
  return {
    cloudinary:   { uploader: { destroy: jest.fn().mockResolvedValue({ result: "ok" }) } },
    upload:       multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
    uploadAvatar: multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } }),
  };
});

const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");
const { cloudinary } = require("../../src/config/cloudinary");

beforeEach(async () => {
  await resetDb();
  cloudinary.uploader.destroy.mockClear();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function register(email, role = "VENDEDOR") {
  const res = await request(app).post("/api/auth/register").send({
    name: "Test", email, password: "clave12345", role,
  });
  return { token: res.body.token, userId: res.body.user.id };
}

async function createProperty(ownerId, images = []) {
  return prisma.property.create({
    data: {
      title: "Casa de prueba", description: "Descripción de prueba bien larga",
      price: 100000, city: "Santo Domingo", lat: 18.5, lng: -69.9,
      images, publishedById: ownerId,
    },
  });
}

describe("POST /api/upload", () => {
  it("rechaza a un CLIENTE — el rol no alcanza (403)", async () => {
    const { token } = await register("cliente@domify.test", "CLIENTE");
    const res = await request(app).post("/api/upload").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("responde 400 si no se manda ninguna imagen", async () => {
    const { token } = await register("vendedor@domify.test");
    const res = await request(app).post("/api/upload").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/upload — IDOR (bug ya arreglado, con regresión)", () => {
  it("rechaza borrar la imagen de la propiedad de OTRO usuario (403)", async () => {
    const owner    = await register("owner@domify.test");
    const attacker = await register("attacker@domify.test");
    const url = "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/abc123.jpg";
    await createProperty(owner.userId, [url]);

    const res = await request(app)
      .delete("/api/upload")
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({ url });

    expect(res.status).toBe(403);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it("permite al dueño borrar la imagen de su propia propiedad", async () => {
    const owner = await register("owner2@domify.test");
    const url = "https://res.cloudinary.com/demo/image/upload/v1/domify/properties/xyz789.jpg";
    await createProperty(owner.userId, [url]);

    const res = await request(app)
      .delete("/api/upload")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ url });

    expect(res.status).toBe(200);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("domify/properties/xyz789");
  });

  it("rechaza borrar el avatar de OTRO usuario (403)", async () => {
    const victim   = await register("victim@domify.test");
    const attacker = await register("attacker2@domify.test");
    const avatarUrl = "https://res.cloudinary.com/demo/image/upload/v1/domify/avatars/victim.jpg";
    await prisma.user.update({ where: { id: victim.userId }, data: { avatar: avatarUrl } });

    const res = await request(app)
      .delete("/api/upload")
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({ url: avatarUrl });

    expect(res.status).toBe(403);
  });

  it("permite borrar el propio avatar", async () => {
    const user = await register("self@domify.test");
    const avatarUrl = "https://res.cloudinary.com/demo/image/upload/v1/domify/avatars/self.jpg";
    await prisma.user.update({ where: { id: user.userId }, data: { avatar: avatarUrl } });

    const res = await request(app)
      .delete("/api/upload")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ url: avatarUrl });

    expect(res.status).toBe(200);
  });

  it("responde 400 si no se manda la url", async () => {
    const { token } = await register("novoid@domify.test");
    const res = await request(app).delete("/api/upload").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });
});
