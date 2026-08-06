const request = require("supertest");
const { generate: generateTotpCode } = require("otplib");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

// Registra un ADMIN de prueba y devuelve { token, user }. El registro público
// no permite crear ADMIN directamente, así que se promueve por fuera, como
// haría un admin ya existente desde el panel.
async function createAdmin(email = "admin@domify.test", password = "claveSegura123") {
  const registerRes = await request(app).post("/api/auth/register").send({
    name: "Admin Test", email, password,
  });
  await prisma.user.update({ where: { id: registerRes.body.user.id }, data: { role: "ADMIN" } });

  const loginRes = await request(app).post("/api/auth/login").send({ email, password });
  return { token: loginRes.body.token, userId: registerRes.body.user.id, email, password };
}

async function enableTwoFactorFor(token) {
  const setupRes = await request(app)
    .post("/api/auth/2fa/setup")
    .set("Authorization", `Bearer ${token}`);
  const { secret } = setupRes.body;

  const code = await generateTotpCode({ secret });
  const enableRes = await request(app)
    .post("/api/auth/2fa/enable")
    .set("Authorization", `Bearer ${token}`)
    .send({ code });

  return { secret, enableRes };
}

describe("2FA (TOTP) para ADMIN", () => {
  it("setup devuelve un secret y un QR, y no activa el 2FA todavía", async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post("/api/auth/2fa/setup")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.secret).toEqual(expect.any(String));
    expect(res.body.qr).toMatch(/^data:image\/png;base64,/);
  });

  it("un rol no-ADMIN no puede acceder a /2fa/setup (403)", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Cliente", email: "cliente@domify.test", password: "clave123456",
    });

    const res = await request(app)
      .post("/api/auth/2fa/setup")
      .set("Authorization", `Bearer ${registerRes.body.token}`);

    expect(res.status).toBe(403);
  });

  it("enable rechaza un código incorrecto (400) y no activa el 2FA", async () => {
    const { token, userId } = await createAdmin();
    await request(app).post("/api/auth/2fa/setup").set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post("/api/auth/2fa/enable")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "000000" });

    expect(res.status).toBe(400);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.totpEnabled).toBe(false);
  });

  it("enable con el código correcto activa el 2FA", async () => {
    const { token, userId } = await createAdmin();
    const { enableRes } = await enableTwoFactorFor(token);

    expect(enableRes.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.totpEnabled).toBe(true);
  });

  it("con 2FA activo, login ya no abre sesión directo — pide el código", async () => {
    const { token, email, password } = await createAdmin();
    await enableTwoFactorFor(token);

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.tempToken).toEqual(expect.any(String));
    expect(res.body.token).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("el tempToken no sirve como sesión normal en rutas protegidas (401)", async () => {
    const { token, email, password } = await createAdmin();
    await enableTwoFactorFor(token);

    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const { tempToken } = loginRes.body;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tempToken}`);

    expect(res.status).toBe(401);
  });

  it("2fa/verify con un código incorrecto rechaza (401)", async () => {
    const { token, email, password } = await createAdmin();
    await enableTwoFactorFor(token);
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });

    const res = await request(app)
      .post("/api/auth/2fa/verify")
      .send({ tempToken: loginRes.body.tempToken, code: "000000" });

    expect(res.status).toBe(401);
  });

  it("2fa/verify con el código correcto completa el login", async () => {
    const { token, email, password } = await createAdmin();
    const { secret } = await enableTwoFactorFor(token);
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });

    const code = await generateTotpCode({ secret });
    const res = await request(app)
      .post("/api/auth/2fa/verify")
      .send({ tempToken: loginRes.body.tempToken, code });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.token}`);
    expect(meRes.status).toBe(200);
  });

  it("disable exige la contraseña actual (401 si es incorrecta)", async () => {
    const { token, userId } = await createAdmin();
    await enableTwoFactorFor(token);

    const res = await request(app)
      .post("/api/auth/2fa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "incorrecta" });

    expect(res.status).toBe(401);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.totpEnabled).toBe(true);
  });

  it("disable con la contraseña correcta desactiva el 2FA y el login vuelve a ser directo", async () => {
    const { token, email, password, userId } = await createAdmin();
    await enableTwoFactorFor(token);

    const disableRes = await request(app)
      .post("/api/auth/2fa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({ password });
    expect(disableRes.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.totpEnabled).toBe(false);
    expect(user.totpSecret).toBeNull();

    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    expect(loginRes.body.requiresTwoFactor).toBeUndefined();
    expect(loginRes.body.token).toEqual(expect.any(String));
  });

  it("el user nunca expone totpSecret en ninguna respuesta", async () => {
    const { token } = await createAdmin();
    await enableTwoFactorFor(token);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.user.totpSecret).toBeUndefined();
    expect(res.body.user.totpEnabled).toBe(true);
  });
});
