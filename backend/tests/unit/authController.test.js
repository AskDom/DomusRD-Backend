jest.mock("../../src/config/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    create:     jest.fn(),
  },
}));
jest.mock("bcryptjs");

const bcrypt = require("bcryptjs");
const prisma = require("../../src/config/prisma");
const { register, login } = require("../../src/controllers/auth.controller");

function mockRes() {
  const res = {};
  res.status      = jest.fn().mockReturnValue(res);
  res.json        = jest.fn().mockReturnValue(res);
  // register()/login() también setean la cookie httpOnly con el JWT (ver
  // authCookie.js) — sin mockear esto, res.cookie(...) explota con
  // "res.cookie is not a function" y el controller lo atrapa como error 500.
  res.cookie      = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(() => {
  process.env.JWT_SECRET = "unit-test-secret";
});

describe("auth.controller register()", () => {
  it("responde 400 si faltan campos requeridos", async () => {
    const req = { body: { email: "a@b.com" } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("responde 409 si el correo ya está registrado", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });
    const req = { body: { name: "Ana", email: "ana@dom.com", password: "12345" } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("crea el usuario con rol CLIENTE por defecto y nunca expone el password", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed-pw");
    prisma.user.create.mockResolvedValue({
      id: "u1", email: "ana@dom.com", name: "Ana", role: "CLIENTE", password: "hashed-pw",
    });

    const req = { body: { name: "Ana", email: "ana@dom.com", password: "12345" } };
    const res = mockRes();

    await register(req, res);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "CLIENTE", password: "hashed-pw" }) })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.user.password).toBeUndefined();
    expect(body.token).toEqual(expect.any(String));
  });

  it("ignora un rol inválido en el body y usa CLIENTE", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed-pw");
    prisma.user.create.mockResolvedValue({ id: "u1", email: "x@x.com", name: "X", role: "CLIENTE" });

    const req = { body: { name: "X", email: "x@x.com", password: "12345", role: "ADMIN" } };
    const res = mockRes();

    await register(req, res);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "CLIENTE" }) })
    );
  });
});

describe("auth.controller login()", () => {
  it("responde 401 con mensaje genérico si el usuario no existe", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const req = { body: { email: "nadie@dom.com", password: "12345" } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Credenciales incorrectas" });
  });

  it("responde 401 con el mismo mensaje si la contraseña no coincide (no filtra cuál campo falló)", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", password: "hashed" });
    bcrypt.compare.mockResolvedValue(false);
    const req = { body: { email: "a@b.com", password: "mala" } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Credenciales incorrectas" });
  });

  it("devuelve token y usuario sin password en login exitoso", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1", email: "a@b.com", name: "A", role: "CLIENTE", password: "hashed",
    });
    bcrypt.compare.mockResolvedValue(true);
    const req = { body: { email: "a@b.com", password: "buena" } };
    const res = mockRes();

    await login(req, res);

    expect(res.status).not.toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.user.password).toBeUndefined();
    expect(body.token).toEqual(expect.any(String));
  });
});
