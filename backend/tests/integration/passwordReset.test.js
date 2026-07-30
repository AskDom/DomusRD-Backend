// Mockeado para que estos tests nunca disparen un envío real por Resend —
// PrismaClient carga el .env real del proyecto al instanciarse (aunque los
// tests corran con .env.test), así que sin este mock se cuela la
// RESEND_API_KEY real y Resend devuelve 403 (no puedes mandar a direcciones
// de prueba que no sean la tuya propia en modo sandbox).
jest.mock("../../src/utils/mailer", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");
const { sendPasswordResetEmail } = require("../../src/utils/mailer");

async function requestResetToken(email) {
  await request(app).post("/api/auth/forgot-password").send({ email });
  const call = sendPasswordResetEmail.mock.calls.find(([to]) => to === email);
  const resetUrl = call ? call[1] : null;
  return resetUrl ? new URL(resetUrl).searchParams.get("token") : null;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("POST /api/auth/forgot-password", () => {
  it("responde 200 y guarda un token hasheado con expiración si el correo existe", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Reset User", email: "reset@domify.test", password: "clave123",
    });

    const token = await requestResetToken("reset@domify.test");
    expect(token).toEqual(expect.any(String));

    const user = await prisma.user.findUnique({ where: { email: "reset@domify.test" } });
    expect(user.resetToken).toEqual(expect.any(String));
    expect(user.resetToken).not.toBe(token); // guardado hasheado, no en texto plano
    expect(user.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it("responde 200 con el mismo mensaje genérico aunque el correo no exista (no revela si existe)", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "no-existe@domify.test" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/si existe una cuenta/i);
  });

  it("rechaza un correo con formato inválido (400)", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "no-es-un-correo" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("rechaza un token que no existe (400)", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({
      token: "token-que-nunca-existio", password: "nuevaClave123",
    });
    expect(res.status).toBe(400);
  });

  it("rechaza un token ya expirado (400)", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Exp", email: "exp@domify.test", password: "clave123",
    });
    const token = await requestResetToken("exp@domify.test");

    await prisma.user.update({
      where: { email: "exp@domify.test" },
      data:  { resetTokenExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "nuevaClave123" });
    expect(res.status).toBe(400);
  });

  it("cambia la contraseña con un token válido, e invalida el token tras usarlo", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Ok", email: "ok@domify.test", password: "viejaClave",
    });
    const token = await requestResetToken("ok@domify.test");

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "nuevaClave123" });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post("/api/auth/login").send({ email: "ok@domify.test", password: "viejaClave" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ email: "ok@domify.test", password: "nuevaClave123" });
    expect(newLogin.status).toBe(200);

    // Un segundo intento con el mismo token ya no debe funcionar (de un solo uso)
    const reuse = await request(app).post("/api/auth/reset-password").send({ token, password: "otraClave456" });
    expect(reuse.status).toBe(400);
  });
});
