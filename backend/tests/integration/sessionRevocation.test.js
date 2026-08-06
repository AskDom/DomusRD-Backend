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

describe("POST /api/auth/logout-all", () => {
  it("invalida el token actual y cualquier otro emitido antes, sin afectar un login nuevo", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Multi Sesion", email: "multisesion@domify.test", password: "clave12345",
    });
    const token = registerRes.body.token;

    const logoutAllRes = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutAllRes.status).toBe(200);

    const meWithOldToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(meWithOldToken.status).toBe(401);

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "multisesion@domify.test", password: "clave12345",
    });
    expect(loginRes.status).toBe(200);

    const meWithNewToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);
    expect(meWithNewToken.status).toBe(200);
  });

  it("responde 401 sin token", async () => {
    const res = await request(app).post("/api/auth/logout-all");
    expect(res.status).toBe(401);
  });
});

describe("Cambiar el rol de un usuario invalida sus sesiones anteriores", () => {
  async function createAdmin() {
    const email = "admin-revoke@domify.test";
    const password = "claveAdmin123";
    const registerRes = await request(app).post("/api/auth/register").send({ name: "Admin", email, password });
    await prisma.user.update({ where: { id: registerRes.body.user.id }, data: { role: "ADMIN" } });
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    return loginRes.body.token;
  }

  it("el token viejo del usuario deja de servir tras el cambio de rol", async () => {
    const adminToken = await createAdmin();

    const targetRes = await request(app).post("/api/auth/register").send({
      name: "Vendedor a Ascender", email: "ascender@domify.test", password: "clave12345", role: "VENDEDOR",
    });
    const targetOldToken = targetRes.body.token;
    const targetId = targetRes.body.user.id;

    const changeRoleRes = await request(app)
      .patch(`/api/admin/users/${targetId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "AGENTE" });
    expect(changeRoleRes.status).toBe(200);

    const meWithOldToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${targetOldToken}`);
    expect(meWithOldToken.status).toBe(401);

    const relogin = await request(app).post("/api/auth/login").send({
      email: "ascender@domify.test", password: "clave12345",
    });
    expect(relogin.status).toBe(200);
    expect(relogin.body.user.role).toBe("AGENTE");
  });
});

describe("Rate limit por cuenta en POST /api/auth/login", () => {
  it("bloquea después de repetidos intentos fallidos contra la MISMA cuenta, sin afectar a otras cuentas", async () => {
    const email = "rate-limit-target@domify.test";
    await request(app).post("/api/auth/register").send({
      name: "Objetivo", email, password: "claveCorrecta1",
    });

    let lastRes;
    for (let i = 0; i < 10; i++) {
      lastRes = await request(app).post("/api/auth/login").send({ email, password: "incorrecta" });
      expect(lastRes.status).toBe(401);
    }

    const blockedRes = await request(app).post("/api/auth/login").send({ email, password: "incorrecta" });
    expect(blockedRes.status).toBe(429);

    // Incluso con la contraseña correcta, el cupo de esta cuenta ya se agotó.
    const blockedEvenWithCorrectPassword = await request(app).post("/api/auth/login").send({ email, password: "claveCorrecta1" });
    expect(blockedEvenWithCorrectPassword.status).toBe(429);

    // Otra cuenta, misma IP de test, no se ve afectada — la clave es el email.
    const otherEmail = "rate-limit-bystander@domify.test";
    await request(app).post("/api/auth/register").send({
      name: "Bystander", email: otherEmail, password: "otraClave123",
    });
    const bystanderRes = await request(app).post("/api/auth/login").send({ email: otherEmail, password: "incorrecta" });
    expect(bystanderRes.status).toBe(401);
  });

  it("los logins exitosos no consumen el cupo (skipSuccessfulRequests)", async () => {
    const email = "rate-limit-happy@domify.test";
    await request(app).post("/api/auth/register").send({
      name: "Happy Path", email, password: "clave12345",
    });

    for (let i = 0; i < 15; i++) {
      const res = await request(app).post("/api/auth/login").send({ email, password: "clave12345" });
      expect(res.status).toBe(200);
    }
  });
});
