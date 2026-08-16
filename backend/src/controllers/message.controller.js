const prisma = require('../config/prisma');
const { sendPushToUser } = require('../utils/pushNotifier');
const { stripHtmlTags } = require('../utils/sanitizeText');

const USER_SELECT = { select: { id: true, name: true, avatar: true } };

// GET /api/messages — conversaciones del usuario autenticado
// Paginación keyset sobre (createdAt, id) — mismo patrón que el listado de
// propiedades: el cliente manda el id del último mensaje recibido en
// ?cursor= y el servidor devuelve los que le siguen (ORDER BY createdAt
// desc, id desc), así el "página 2" no depende de un OFFSET que se degrada
// con listas largas. Antes esto traía TODOS los mensajes del usuario en un
// solo request y crecía sin límite con cada conversación.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT     = 500;

const getMessages = async (req, res) => {
  try {
    const userId = req.user.userId;

    const requestedLimit = parseInt(req.query.limit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const cursor = req.query.cursor;

    const where = { OR: [{ fromId: userId }, { toId: userId }] };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          from:     USER_SELECT,
          to:       USER_SELECT,
          property: { select: { id: true, title: true, images: true } },
          visit:    { select: { id: true, status: true, scheduledAt: true, message: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take:    limit + 1, // uno de más solo para decidir hasMore
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.message.count({ where }),
    ]);

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const last = page[page.length - 1];

    res.json({
      messages: page,
      pagination: {
        hasMore,
        nextCursor: hasMore && last ? last.id : null,
        total,
      },
    });
  } catch (error) {
    console.error('❌ getMessages:', error);
    res.status(500).json({ error: 'Error al obtener mensajes.' });
  }
};

// POST /api/messages — envía un mensaje
const sendMessage = async (req, res) => {
  try {
    const { toId, propertyId, replyToId } = req.body;
    const text = stripHtmlTags(req.body.text);
    if (!toId || !propertyId || !text?.trim()) {
      return res.status(400).json({ error: 'toId, propertyId y text son obligatorios.' });
    }

    if (toId === req.user.userId) {
      return res.status(400).json({ error: 'No podés enviarte un mensaje a vos mismo.' });
    }

    // Existencia explícita de destinatario y propiedad — sin esto, un UUID
    // inventado caía en un error de foreign key (500) en vez de un 404.
    const [recipient, property] = await Promise.all([
      prisma.user.findUnique({ where: { id: toId }, select: { id: true } }),
      prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } }),
    ]);
    if (!recipient) return res.status(404).json({ error: 'El destinatario no existe.' });
    if (!property) return res.status(404).json({ error: 'La propiedad no existe.' });

    // El mensaje al que se responde tiene que ser de esta misma conversación
    // (entre estos dos usuarios) — sin esto, cualquiera podía mandar un
    // replyToId apuntando a un mensaje de un hilo ajeno.
    if (replyToId) {
      const original = await prisma.message.findUnique({
        where: { id: replyToId }, select: { fromId: true, toId: true },
      });
      const participants = [req.user.userId, toId];
      if (!original || !participants.includes(original.fromId) || !participants.includes(original.toId)) {
        return res.status(403).json({ error: 'No podés responder a un mensaje fuera de esta conversación.' });
      }
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
    console.error('❌ sendMessage:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
};

// PATCH /api/messages/read-all — marca como leída toda una conversación
// (todos los mensajes de otherId→mí de una misma propiedad) en una sola
// query. La app marcaba antes mensaje por mensaje (N requests por hilo).
const markConversationRead = async (req, res) => {
  try {
    const { otherId, propertyId } = req.body;
    if (!otherId || !propertyId) {
      return res.status(400).json({ error: 'otherId y propertyId son obligatorios.' });
    }

    const result = await prisma.message.updateMany({
      where: {
        fromId:     otherId,
        toId:       req.user.userId,
        propertyId,
        read:       false,
      },
      data: { read: true },
    });

    res.json({ message: 'Conversación marcada como leída.', updated: result.count });
  } catch (error) {
    console.error('❌ markConversationRead:', error);
    res.status(500).json({ error: 'Error al marcar como leído.' });
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
    console.error('❌ markAsRead:', error);
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
    console.error('❌ deleteMessage:', error);
    res.status(500).json({ error: 'Error al eliminar el mensaje.' });
  }
};

module.exports = { getMessages, sendMessage, markAsRead, markConversationRead, deleteMessage };