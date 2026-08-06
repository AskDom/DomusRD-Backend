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

describe("POST /api/auth/register", () => {
  it("registra un usuario nuevo y devuelve token sin exponer el password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Ana Pérez",
      email: "ana@domify.test",
      password: "clave123",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("ana@domify.test");
    expect(res.body.user.role).toBe("CLIENTE");
    expect(res.body.user.password).toBeUndefined();
  });

  it("rechaza el registro con datos inválidos (400)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "no-es-un-correo",
      password: "123",
    });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.fields)).toBe(true);
  });

  it("rechaza un correo ya registrado (409)", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Ana", email: "dup@domify.test", password: "clave123",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Ana Otra vez", email: "dup@domify.test", password: "otraclave",
    });

    expect(res.status).toBe(409);
  });

  it("rechaza un password de menos de 8 caracteres (400)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Ana", email: "corta@domify.test", password: "corta12",
    });

    expect(res.status).toBe(400);
    expect(res.body.fields.some((f) => f.field === "password")).toBe(true);
  });
});

describe("El JWT en el body de register/login solo va al cliente móvil", () => {
  it("register sin el header x-domify-client incluye el token (app móvil)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Móvil", email: "movil-register@domify.test", password: "clave1234",
    });

    expect(res.body.token).toEqual(expect.any(String));
  });

  it("register con x-domify-client: web NO incluye el token, pero sí abre la cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("x-domify-client", "web")
      .send({ name: "Web", email: "web-register@domify.test", password: "clave1234" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("login con x-domify-client: web NO incluye el token, pero sí abre la cookie", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Web Login", email: "web-login@domify.test", password: "clave1234",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .set("x-domify-client", "web")
      .send({ email: "web-login@domify.test", password: "clave1234" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User", email: "login@domify.test", password: "clave123",
    });
  });

  it("hace login con credenciales correctas", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@domify.test", password: "clave123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("rechaza contraseña incorrecta con mensaje genérico (401)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@domify.test", password: "incorrecta",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales incorrectas");
  });
});

describe("GET /api/auth/me", () => {
  it("responde 401 sin token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("devuelve el usuario autenticado con token válido", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Me User", email: "me@domify.test", password: "clave123",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registerRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@domify.test");
  });
});
