const request = require("supertest");
const app     = require("../../src/app");
const { prisma, resetDb } = require("../helpers/testDb");

async function registerCliente(email) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Cliente Test", email, password: "clave123",
  });
  return { token: res.body.token, user: res.body.user };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("GET /api/notifications", () => {
  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("solo devuelve las notificaciones del usuario autenticado", async () => {
    const userA = await registerCliente("userA@domify.test");
    const userB = await registerCliente("userB@domify.test");

    await prisma.notification.create({
      data: { userId: userA.user.id, message: "Notificación de A" },
    });
    await prisma.notification.create({
      data: { userId: userB.user.id, message: "Notificación de B" },
    });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${userA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].message).toBe("Notificación de A");
  });
});

describe("PATCH /api/notifications/:id/read", () => {
  it("un usuario no puede marcar como leída la notificación de otro", async () => {
    const owner    = await registerCliente("owner@domify.test");
    const outsider = await registerCliente("outsider@domify.test");

    const notification = await prisma.notification.create({
      data: { userId: owner.user.id, message: "Notificación privada" },
    });

    await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${outsider.token}`);

    const untouched = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(untouched.read).toBe(false);
  });

  it("el dueño de la notificación sí puede marcarla como leída", async () => {
    const owner = await registerCliente("owner2@domify.test");

    const notification = await prisma.notification.create({
      data: { userId: owner.user.id, message: "Notificación privada" },
    });

    const res = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const updated = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(updated.read).toBe(true);
  });
});

describe("PATCH /api/notifications/read-all", () => {
  it("solo marca como leídas las notificaciones propias, no las de otros usuarios", async () => {
    const owner = await registerCliente("owner3@domify.test");
    const other = await registerCliente("other3@domify.test");

    await prisma.notification.create({ data: { userId: owner.user.id, message: "A" } });
    await prisma.notification.create({ data: { userId: owner.user.id, message: "B" } });
    const otherNotification = await prisma.notification.create({
      data: { userId: other.user.id, message: "C" },
    });

    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const ownerUnread = await prisma.notification.count({
      where: { userId: owner.user.id, read: false },
    });
    expect(ownerUnread).toBe(0);

    const otherStillUnread = await prisma.notification.findUnique({
      where: { id: otherNotification.id },
    });
    expect(otherStillUnread.read).toBe(false);
  });
});
