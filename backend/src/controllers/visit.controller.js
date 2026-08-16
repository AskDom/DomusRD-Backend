const prisma = require('../config/prisma');
const { sendPushToUser } = require('../utils/pushNotifier');
const { stripHtmlTags } = require('../utils/sanitizeText');

const VALID_STATUSES = ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA'];

const USER_SELECT = { select: { id: true, name: true, avatar: true } };
const VISIT_MESSAGE_SELECT = { select: { id: true, status: true, scheduledAt: true, message: true } };

// Crea el mensaje de DM que representa una visita (la solicitud inicial del
// interesado o el cambio de estado del dueño) y lo entrega en tiempo real:
// socket para ambos participantes y push para el receptor. El `visitId`
// permite pintar la tarjeta con estado y acciones (confirmar/cancelar) directo
// en el hilo de mensajería, sin depender solo del texto.
const emitVisitMessage = async ({ app, fromId, toId, propertyId, visit, text }) => {
  const message = await prisma.message.create({
    data: { fromId, toId, propertyId, visitId: visit.id, text },
    include: {
      from:     USER_SELECT,
      to:       USER_SELECT,
      property: { select: { id: true, title: true } },
      visit:    VISIT_MESSAGE_SELECT,
    },
  });

  const io = app.get('io');
  if (io) {
    const normalized = {
      id:            message.id,
      fromId:        message.fromId,
      fromName:      message.from?.name  || 'Usuario',
      fromAvatar:    message.from?.avatar || null,
      toId:          message.toId,
      toName:        message.to?.name    || 'Usuario',
      toAvatar:      message.to?.avatar  || null,
      propertyId:    message.propertyId,
      propertyTitle: message.property?.title || '',
      text:          message.text,
      replyToId:     message.replyToId,
      createdAt:     message.createdAt,
      read:          false,
      visit:         message.visit,
    };
    // Al receptor como mensaje nuevo; al emisor como confirmación (por si
    // tiene otra pestaña/dispositivo abierta en el mismo hilo).
    io.to(`user:${toId}`).emit('new_message', normalized);
    io.to(`user:${fromId}`).emit('message_sent', normalized);
  }

  sendPushToUser(toId, {
    title: message.from?.name || 'Nuevo mensaje',
    body: message.text,
    data: {
      type: 'message',
      conversationWith: message.fromId,
      otherName: message.from?.name || 'Usuario',
      propertyId: message.propertyId,
      propertyTitle: message.property?.title || '',
    },
  });

  return message;
};

const formatVisitDate = (date) => date.toLocaleString('es-DO');

// Shape consistente para ambos lados del dashboard (mis solicitudes y las
// visitas que recibo) — el detalle trae el interesado y la propiedad con su
// dueño, suficiente para pintar la tarjeta sin pedir más datos.
const VISIT_INCLUDE = {
  user:     { select: { id: true, name: true, avatar: true } },
  property: {
    include: {
      publishedBy: { select: { id: true, name: true, avatar: true } },
    },
  },
};

// POST /api/visits — agenda una visita a una propiedad ajena
const createVisit = async (req, res) => {
  try {
    const { propertyId } = req.body;
    const userId = req.user.userId;
    const message = stripHtmlTags(req.body.message);

    const scheduledAt = new Date(req.body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: 'La fecha de la visita es obligatoria.' });
    }
    // No permitir agendar en el pasado — una visita que ya "pasó" no tiene
    // sentido y el frontend lo puede mostrar mal.
    if (scheduledAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'La visita debe ser en el futuro.' });
    }
    if (message && message.trim().length > 500) {
      return res.status(400).json({ error: 'El mensaje no puede exceder 500 caracteres.' });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, publishedById: true, title: true },
    });
    if (!property) return res.status(404).json({ error: 'La propiedad no existe.' });

    // El dueño no se agenda visitas a sí mismo — para eso está su propio
    // calendario, no el flujo de interesados.
    if (property.publishedById === userId) {
      return res.status(403).json({ error: 'No podés agendar una visita a tu propia propiedad.' });
    }

    const visit = await prisma.visit.create({
      data: {
        userId,
        propertyId,
        scheduledAt,
        message: message?.trim() || null,
      },
      include: VISIT_INCLUDE,
    });

    // ── NOTIFICACIÓN AL DUEÑO ──────────────────────────────────────────────
    // Registro en la base (para el campanita) + push (app móvil) + socket
    // (para que el campanita se entere al instante). El registro en la base
    // es síncrono para no perder notificaciones; el push y el socket son
    // best-effort y nunca rompen la respuesta si fallan.
    const notifyText = `${visit.user.name} quiere visitar "${property.title}" el ${formatVisitDate(scheduledAt)}.`;

    try {
      await prisma.notification.create({
        data: { userId: property.publishedById, message: notifyText, propertyId },
      });
    } catch (err) {
      console.error('❌ Notification visit:', err);
    }

    sendPushToUser(property.publishedById, {
      title: 'Nueva solicitud de visita',
      body: notifyText,
      data: { type: 'visit', visitId: visit.id, propertyId },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${property.publishedById}`).emit('new_notification', {
        message: notifyText,
        propertyId,
        visitId: visit.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    // ── MENSAJE EN EL DM ────────────────────────────────────────────────────
    // El pedido también llega como mensaje del interesado en el hilo de
    // mensajería con la propiedad (con visitId para poder confirmar/cancelar
    // desde ahí). Best-effort: si falla, la visita y la notificación quedan.
    try {
      const visitText = `Solicitud de visita para el ${formatVisitDate(scheduledAt)}.`;
      await emitVisitMessage({
        app: req.app,
        fromId: visit.userId,
        toId: property.publishedById,
        propertyId: visit.propertyId,
        visit,
        text: message?.trim()
          ? `${visitText}\n\n${message.trim()}`
          : visitText,
      });
    } catch (err) {
      console.error('❌ Visit message:', err);
    }

    res.status(201).json({ visit });
  } catch (error) {
    console.error('❌ createVisit:', error);
    res.status(500).json({ error: 'Error al agendar la visita.' });
  }
};

// GET /api/visits/mine — las visitas que yo solicité
const getMyVisits = async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      where:   { userId: req.user.userId },
      include: VISIT_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    });
    res.json({ visits });
  } catch (error) {
    console.error('❌ getMyVisits:', error);
    res.status(500).json({ error: 'Error al obtener tus visitas.' });
  }
};

// GET /api/visits/received — visitas a mis propiedades
const getReceivedVisits = async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      where:   { property: { publishedById: req.user.userId } },
      include: VISIT_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    });
    res.json({ visits });
  } catch (error) {
    console.error('❌ getReceivedVisits:', error);
    res.status(500).json({ error: 'Error al obtener las visitas.' });
  }
};

// PATCH /api/visits/:id/status — confirma/cancela/completa una visita.
// El dueño de la propiedad (o un admin) puede cambiar cualquier estado; el
// interesado solo puede CANCELAR su propia solicitud pendiente.
const updateVisitStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Válidos: ${VALID_STATUSES.join(', ')}.` });
    }

    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true } },
        property: { select: { id: true, publishedById: true, title: true } },
      },
    });
    if (!visit) return res.status(404).json({ error: 'La visita no existe.' });

    const isOwner       = visit.property.publishedById === req.user.userId;
    const isAdmin       = req.user.role === 'ADMIN';
    const isRequester   = visit.userId === req.user.userId;

    if (isRequester && !isOwner && !isAdmin) {
      // El interesado solo puede cancelar su propia solicitud.
      if (status !== 'CANCELADA') {
        return res.status(403).json({ error: 'Solo podés cancelar tu solicitud de visita.' });
      }
      if (visit.status !== 'PENDIENTE') {
        return res.status(409).json({ error: 'Solo podés cancelar una visita pendiente.' });
      }
    } else if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'No tenés permiso para modificar esta visita.' });
    }

    const updated = await prisma.visit.update({
      where:  { id: visit.id },
      data:   { status },
      include: VISIT_INCLUDE,
    });

    // ── MENSAJE EN EL DM ────────────────────────────────────────────────────
    // Cualquier cambio de estado deja constancia en el hilo: el actor (dueño
    // o interesado) le escribe a la otra parte con el resultado. Best-effort.
    if (status !== 'PENDIENTE') {
      const statusLabel = { CONFIRMADA: 'confirmada', CANCELADA: 'cancelada', COMPLETADA: 'completada' }[status];
      const otherId = req.user.userId === visit.userId ? visit.property.publishedById : visit.userId;
      const dateText = formatVisitDate(visit.scheduledAt);

      try {
        await emitVisitMessage({
          app: req.app,
          fromId: req.user.userId,
          toId: otherId,
          propertyId: visit.propertyId,
          visit: {
            id: visit.id,
            status,
            scheduledAt: visit.scheduledAt,
            message: visit.message,
          },
          text: `Tu solicitud de visita para el ${dateText} fue ${statusLabel}.`,
        });
      } catch (err) {
        console.error('❌ Visit status message:', err);
      }
    }

    // ── NOTIFICACIÓN AL INTERESADO ──────────────────────────────────────────
    // Solo cuando el cambio lo hace el dueño (o admin): el interesado ya sabe
    // que canceló la suya. Mismo patrón: registro en la base + push + socket.
    if (status !== 'PENDIENTE' && visit.userId !== req.user.userId) {
      const statusLabel = { CONFIRMADA: 'confirmada', CANCELADA: 'cancelada', COMPLETADA: 'completada' }[status];
      const notifyText = `Tu visita a "${visit.property.title}" fue ${statusLabel}.`;

      try {
        await prisma.notification.create({
          data: { userId: visit.userId, message: notifyText, propertyId: visit.propertyId },
        });
      } catch (err) {
        console.error('❌ Notification visit status:', err);
      }

      sendPushToUser(visit.userId, {
        title: 'Actualización de visita',
        body: notifyText,
        data: { type: 'visit', visitId: visit.id, propertyId: visit.propertyId },
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${visit.userId}`).emit('new_notification', {
          message: notifyText,
          propertyId: visit.propertyId,
          visitId: visit.id,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.json({ visit: updated });
  } catch (error) {
    console.error('❌ updateVisitStatus:', error);
    res.status(500).json({ error: 'Error al actualizar la visita.' });
  }
};

module.exports = { createVisit, getMyVisits, getReceivedVisits, updateVisitStatus };
