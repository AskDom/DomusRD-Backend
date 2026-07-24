const jwt = require("jsonwebtoken");
const { protect, requireRole, isOwner } = require("../../src/middlewares/auth.middleware");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

describe("auth.middleware protect()", () => {
  const OLD_ENV = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = "unit-test-secret"; });
  afterAll(() => { process.env.JWT_SECRET = OLD_ENV; });

  it("rechaza la petición si no hay header Authorization", async () => {
    const req  = { headers: {} };
    const res  = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rechaza un token inválido", async () => {
    const req  = { headers: { authorization: "Bearer token-basura" } };
    const res  = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("deja pasar un token válido y llena req.user desde el payload", async () => {
    const token = jwt.sign({ id: "user-1", email: "a@b.com", role: "VENDEDOR" }, process.env.JWT_SECRET);
    const req   = { headers: { authorization: `Bearer ${token}` } };
    const res   = mockRes();
    const next  = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ userId: "user-1", email: "a@b.com", role: "VENDEDOR" });
  });
});

describe("auth.middleware requireRole()", () => {
  it("permite el acceso si el rol del usuario está en la lista", () => {
    const req  = { user: { role: "AGENTE" } };
    const res  = mockRes();
    const next = jest.fn();

    requireRole("VENDEDOR", "AGENTE")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("bloquea con 403 si el rol no está permitido", () => {
    const req  = { user: { role: "CLIENTE" } };
    const res  = mockRes();
    const next = jest.fn();

    requireRole("VENDEDOR", "AGENTE")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloquea con 401 si no hay usuario autenticado", () => {
    const req  = {};
    const res  = mockRes();
    const next = jest.fn();

    requireRole("ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("auth.middleware isOwner()", () => {
  it("devuelve true cuando el usuario autenticado es el dueño del recurso", () => {
    const req = { user: { userId: "user-1" } };
    const res = mockRes();

    expect(isOwner("user-1", req, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responde 403 y devuelve false cuando el usuario no es el dueño", () => {
    const req = { user: { userId: "user-2" } };
    const res = mockRes();

    expect(isOwner("user-1", req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
