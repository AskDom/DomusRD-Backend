const { clampPagination } = require("../../src/controllers/admin.controller");

describe("admin.controller clampPagination()", () => {
  it("usa los valores por defecto cuando no se manda nada", () => {
    expect(clampPagination(undefined, undefined)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("respeta page/limit válidos dentro de rango", () => {
    expect(clampPagination("3", "10")).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it("capa un limit absurdamente grande a 100 en vez de dejarlo pasar", () => {
    const { limit } = clampPagination("1", "999999999");
    expect(limit).toBe(100);
  });

  it("un limit en 0 cae al default de 20 (0 es falsy)", () => {
    expect(clampPagination("1", "0").limit).toBe(20);
  });

  it("un limit negativo se sube al mínimo de 1, nunca queda negativo", () => {
    expect(clampPagination("1", "-5").limit).toBe(1);
  });

  it("no deja una page en 0 o negativa — la sube a 1", () => {
    expect(clampPagination("0", "20").page).toBe(1);
    expect(clampPagination("-3", "20").page).toBe(1);
  });
});
