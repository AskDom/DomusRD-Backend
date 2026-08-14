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

describe("PATCH /api/auth/me", () => {
  let token;
  let userId;

  beforeEach(async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Perfil Original", email: "perfil@domify.test", password: "clave123",
    });
    token  = registerRes.body.token;
    userId = registerRes.body.user.id;
  });

  it("actualiza nombre y correo sin rotar la sesión", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Perfil Nuevo", email: "perfil-nuevo@domify.test" });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Perfil Nuevo");
    expect(res.body.user.email).toBe("perfil-nuevo@domify.test");
    expect(res.body.token).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it("no devuelve nada sin autenticación", async () => {
    const res = await request(app).patch("/api/auth/me").send({ name: "X" });
    expect(res.status).toBe(401);
  });

  it("rechaza correo que ya pertenece a otro usuario (409)", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Dueño", email: "dueno@domify.test", password: "clave123",
    });

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "dueno@domify.test" });

    expect(res.status).toBe(409);
  });

  it("cambiar contraseña exige currentPassword (400)", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "nuevacontraseña" });

    expect(res.status).toBe(400);
  });

  it("rechaza currentPassword incorrecto (401)", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "incorrecta", newPassword: "nuevacontraseña" });

    expect(res.status).toBe(401);
  });

  it("rota la contraseña, emite token nuevo y revoca el anterior", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "clave123", newPassword: "clave123456" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.token).not.toBe(token);

    // El token viejo ya no sirve (tokenVersion++ revocó todos los anteriores).
    const oldTokenRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(oldTokenRes.status).toBe(401);

    // El token nuevo sigue funcionando en esta sesión.
    const newTokenRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.token}`);
    expect(newTokenRes.status).toBe(200);

    // Y el login con la contraseña nueva también.
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "perfil@domify.test", password: "clave123456",
    });
    expect(loginRes.status).toBe(200);
  });

  it("valida que la nueva contraseña tenga mínimo 8 caracteres (400)", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "clave123", newPassword: "corta" });

    expect(res.status).toBe(400);
  });
});
