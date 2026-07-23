const prisma = require('../config/prisma');

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
    console.error('getNotifications:', err);
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
    console.error('markAsRead:', err);
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
    console.error('markAllAsRead:', err);
    res.status(500).json({ error: 'Error al marcar todas como leídas.' });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
