jest.mock("../../src/utils/mailer", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");
const { sendVerificationEmail } = require("../../src/utils/mailer");

// Toma la llamada MÁS RECIENTE para ese correo — con reenvío, mailer se
// llama más de una vez para el mismo email dentro del mismo test.
async function getVerifyToken(email) {
  const calls = sendVerificationEmail.mock.calls.filter(([to]) => to === email);
  const call  = calls[calls.length - 1];
  const verifyUrl = call ? call[1] : null;
  return verifyUrl ? new URL(verifyUrl).searchParams.get("token") : null;
}

function samplePropertyPayload() {
  return {
    title: "Apartamento amplio en Piantini",
    description: "Descripción suficientemente larga para pasar la validación.",
    price: 150000,
    city: "Santo Domingo",
    lat: 18.4655,
    lng: -69.9313,
  };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("crea al usuario con emailVerified=false y le manda un correo de verificación", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Ana", email: "ana@domusrd.test", password: "clave123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.emailVerified).toBe(false);

    const token = await getVerifyToken("ana@domusrd.test");
    expect(token).toEqual(expect.any(String));
  });
});

describe("POST /api/auth/verify-email", () => {
  it("rechaza un token que no existe (400)", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({ token: "token-basura" });
    expect(res.status).toBe(400);
  });

  it("rechaza un token expirado (400)", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Exp", email: "exp@domusrd.test", password: "clave123",
    });
    const token = await getVerifyToken("exp@domusrd.test");

    await prisma.user.update({
      where: { email: "exp@domusrd.test" },
      data:  { verifyTokenExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post("/api/auth/verify-email").send({ token });
    expect(res.status).toBe(400);
  });

  it("verifica el correo con un token válido, e invalida el token tras usarlo", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Ok", email: "ok@domusrd.test", password: "clave123",
    });
    const token = await getVerifyToken("ok@domusrd.test");

    const res = await request(app).post("/api/auth/verify-email").send({ token });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: "ok@domusrd.test" } });
    expect(user.emailVerified).toBe(true);
    expect(user.verifyToken).toBeNull();

    const reuse = await request(app).post("/api/auth/verify-email").send({ token });
    expect(reuse.status).toBe(400);
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("responde 401 sin autenticación", async () => {
    const res = await request(app).post("/api/auth/resend-verification");
    expect(res.status).toBe(401);
  });

  it("reenvía el correo con un token nuevo si aún no está verificado", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Reenvio", email: "reenvio@domusrd.test", password: "clave123",
    });
    const firstToken = await getVerifyToken("reenvio@domusrd.test");

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .set("Authorization", `Bearer ${registerRes.body.token}`);
    expect(res.status).toBe(200);

    const secondToken = await getVerifyToken("reenvio@domusrd.test");
    expect(secondToken).not.toBe(firstToken);

    // El token viejo ya no debe servir, solo el más reciente
    const verifyOld = await request(app).post("/api/auth/verify-email").send({ token: firstToken });
    expect(verifyOld.status).toBe(400);

    const verifyNew = await request(app).post("/api/auth/verify-email").send({ token: secondToken });
    expect(verifyNew.status).toBe(200);
  });

  it("responde con mensaje informativo si el correo ya estaba verificado", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Verificado", email: "verificado@domusrd.test", password: "clave123",
    });
    const token = await getVerifyToken("verificado@domusrd.test");
    await request(app).post("/api/auth/verify-email").send({ token });

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .set("Authorization", `Bearer ${registerRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/ya está verificado/i);
  });
});

describe("Gate de correo verificado en POST /api/properties", () => {
  it("bloquea a un vendedor sin verificar (403)", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Sin Verificar", email: "sinverificar@domusrd.test", password: "clave123", role: "VENDEDOR",
    });

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${registerRes.body.token}`)
      .send(samplePropertyPayload());

    expect(res.status).toBe(403);
  });

  it("permite publicar en cuanto el vendedor verifica su correo", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Ahora Si", email: "ahorasi@domusrd.test", password: "clave123", role: "VENDEDOR",
    });
    const token = await getVerifyToken("ahorasi@domusrd.test");
    await request(app).post("/api/auth/verify-email").send({ token });

    const res = await request(app)
      .post("/api/properties")
      .set("Authorization", `Bearer ${registerRes.body.token}`)
      .send(samplePropertyPayload());

    expect(res.status).toBe(201);
  });
});
