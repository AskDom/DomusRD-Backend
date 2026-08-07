const prisma = require('../config/prisma');
const logger = require('../config/logger');

// GET /api/notifications — las notificaciones del usuario autenticado
const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.userId, read: false },
    });
    res.json({ notifications, unreadCount });
  } catch (err) {
    logger.error('getNotifications', err);
    res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.userId },
      data:  { read: true },
    });
    res.json({ message: 'Marcada como leída.' });
  } catch (err) {
    logger.error('markAsRead', err);
    res.status(500).json({ error: 'Error al marcar como leída.' });
  }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, read: false },
      data:  { read: true },
    });
    res.json({ message: 'Todas marcadas como leídas.' });
  } catch (err) {
    logger.error('markAllAsRead', err);
    res.status(500).json({ error: 'Error al marcar todas como leídas.' });
  }
};

// POST /api/notifications/push-token — registra (o reasigna) un Expo push token
const registerPushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token es obligatorio.' });
    }
    // El token es único por dispositivo, no por usuario: si el mismo
    // dispositivo ya estaba registrado con otra cuenta (logout + login con
    // otro usuario), lo reasignamos en vez de fallar por la unique constraint.
    await prisma.pushToken.upsert({
      where:  { token },
      update: { userId: req.user.userId, platform: platform || null },
      create: { userId: req.user.userId, token, platform: platform || null },
    });
    res.status(201).json({ message: 'Token registrado.' });
  } catch (err) {
    logger.error('registerPushToken', err);
    res.status(500).json({ error: 'Error al registrar el token.' });
  }
};

// DELETE /api/notifications/push-token — desregistra todos los tokens del usuario (logout)
const unregisterPushToken = async (req, res) => {
  try {
    await prisma.pushToken.deleteMany({ where: { userId: req.user.userId } });
    res.json({ message: 'Token(s) desregistrado(s).' });
  } catch (err) {
    logger.error('unregisterPushToken', err);
    res.status(500).json({ error: 'Error al desregistrar el token.' });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, registerPushToken, unregisterPushToken };
