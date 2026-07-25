const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

// En test no hay RESEND_API_KEY configurada, así que mailer.js solo hace
// console.warn con el link de reseteo en vez de enviar un correo real.
// Interceptamos ese warn para sacar el token, tal como lo sacaría el usuario
// del correo real.
async function requestResetToken(email) {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  await request(app).post("/api/auth/forgot-password").send({ email });
  const call = warnSpy.mock.calls.find((args) => args[0]?.includes("Link de reseteo"));
  warnSpy.mockRestore();
  const url = call ? call[1] : null;
  return url ? new URL(url).searchParams.get("token") : null;
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
      name: "Reset User", email: "reset@domusrd.test", password: "clave123",
    });

    const token = await requestResetToken("reset@domusrd.test");
    expect(token).toEqual(expect.any(String));

    const user = await prisma.user.findUnique({ where: { email: "reset@domusrd.test" } });
    expect(user.resetToken).toEqual(expect.any(String));
    expect(user.resetToken).not.toBe(token); // guardado hasheado, no en texto plano
    expect(user.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it("responde 200 con el mismo mensaje genérico aunque el correo no exista (no revela si existe)", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "no-existe@domusrd.test" });
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
      name: "Exp", email: "exp@domusrd.test", password: "clave123",
    });
    const token = await requestResetToken("exp@domusrd.test");

    await prisma.user.update({
      where: { email: "exp@domusrd.test" },
      data:  { resetTokenExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "nuevaClave123" });
    expect(res.status).toBe(400);
  });

  it("cambia la contraseña con un token válido, e invalida el token tras usarlo", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Ok", email: "ok@domusrd.test", password: "viejaClave",
    });
    const token = await requestResetToken("ok@domusrd.test");

    const res = await request(app).post("/api/auth/reset-password").send({ token, password: "nuevaClave123" });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post("/api/auth/login").send({ email: "ok@domusrd.test", password: "viejaClave" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ email: "ok@domusrd.test", password: "nuevaClave123" });
    expect(newLogin.status).toBe(200);

    // Un segundo intento con el mismo token ya no debe funcionar (de un solo uso)
    const reuse = await request(app).post("/api/auth/reset-password").send({ token, password: "otraClave456" });
    expect(reuse.status).toBe(400);
  });
});
