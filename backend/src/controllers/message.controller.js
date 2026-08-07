const prisma = require('../config/prisma');
const { sendPushToUser } = require('../utils/pushNotifier');
const logger = require('../config/logger');

const USER_SELECT = { select: { id: true, name: true, avatar: true } };

// GET /api/messages — conversaciones del usuario autenticado
const getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const messages = await prisma.message.findMany({
      where: { OR: [{ fromId: userId }, { toId: userId }] },
      include: {
        from:     USER_SELECT,
        to:       USER_SELECT,
        property: { select: { id: true, title: true, images: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ messages });
  } catch (error) {
    logger.error('getMessages', error);
    res.status(500).json({ error: 'Error al obtener mensajes.' });
  }
};

// POST /api/messages — envía un mensaje
const sendMessage = async (req, res) => {
  try {
    const { toId, propertyId, text, replyToId } = req.body;
    if (!toId || !propertyId || !text?.trim()) {
      return res.status(400).json({ error: 'toId, propertyId y text son obligatorios.' });
    }
    const message = await prisma.message.create({
      data: {
        fromId: req.user.userId,
        toId,
        propertyId,
        text: text.trim(),
        replyToId: replyToId || null,
      },
      include: {
        from:     USER_SELECT,
        to:       USER_SELECT,
        property: { select: { id: true, title: true } },
      },
    });

    // ── SOCKET.IO: emitir mensaje en tiempo real al receptor ──────────────────
    const io = req.app.get("io");
    if (io) {
      const normalized = {
        id:            message.id,
        fromId:        message.fromId,
        fromName:      message.from?.name || "Usuario",
        fromAvatar:    message.from?.avatar || null,
        toId:          message.toId,
        toName:        message.to?.name   || "Usuario",
        toAvatar:      message.to?.avatar || null,
        propertyId:    message.propertyId,
        propertyTitle: message.property?.title || "",
        text:          message.text,
        replyToId:     message.replyToId,
        createdAt:     message.createdAt,
        read:          false,
      };
      // Emitir a la sala personal del receptor
      io.to(`user:${toId}`).emit("new_message", normalized);
      // También al emisor para confirmar (en caso de múltiples pestañas)
      io.to(`user:${req.user.userId}`).emit("message_sent", normalized);
    }

    // Push notification al receptor — no bloquea la respuesta ni la falla si
    // el envío no funciona (usuario sin token, servicio caído, etc.).
    sendPushToUser(toId, {
      title: message.from?.name || "Nuevo mensaje",
      body: message.text,
      data: {
        type: "message",
        conversationWith: message.fromId,
        otherName: message.from?.name || "Usuario",
        propertyId: message.propertyId,
        propertyTitle: message.property?.title || "",
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    logger.error('sendMessage', error);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
};

// PATCH /api/messages/:id/read — marca como leído
const markAsRead = async (req, res) => {
  try {
    await prisma.message.updateMany({
      where: { id: req.params.id, toId: req.user.userId },
      data:  { read: true },
    });
    res.json({ message: 'Marcado como leído.' });
  } catch (error) {
    logger.error('markAsRead', error);
    res.status(500).json({ error: 'Error al marcar como leído.' });
  }
};

// DELETE /api/messages/:id — elimina un mensaje (solo el receptor)
const deleteMessage = async (req, res) => {
  try {
    await prisma.message.deleteMany({
      where: { id: req.params.id, toId: req.user.userId },
    });
    res.json({ message: 'Mensaje eliminado.' });
  } catch (error) {
    logger.error('deleteMessage', error);
    res.status(500).json({ error: 'Error al eliminar el mensaje.' });
  }
};

module.exports = { getMessages, sendMessage, markAsRead, deleteMessage };