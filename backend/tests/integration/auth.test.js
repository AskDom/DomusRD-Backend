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
      email: "ana@domusrd.test",
      password: "clave123",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("ana@domusrd.test");
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
      name: "Ana", email: "dup@domusrd.test", password: "clave123",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Ana Otra vez", email: "dup@domusrd.test", password: "otraclave",
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User", email: "login@domusrd.test", password: "clave123",
    });
  });

  it("hace login con credenciales correctas", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@domusrd.test", password: "clave123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("rechaza contraseña incorrecta con mensaje genérico (401)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "login@domusrd.test", password: "incorrecta",
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
      name: "Me User", email: "me@domusrd.test", password: "clave123",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registerRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@domusrd.test");
  });
});
