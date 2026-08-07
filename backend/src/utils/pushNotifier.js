const prisma = require('../config/prisma');
const logger = require('../config/logger');

// Notificación push vía Expo (sin API key, mismo servicio para iOS y
// Android) — nunca debe tirar ni bloquear al que la llama: si un usuario no
// tiene push token registrado (o el envío falla), simplemente no pasa nada.
async function sendPushToUser(userId, { title, body, data }) {
  try {
    const tokens = await prisma.pushToken.findMany({ where: { userId } });
    if (!tokens.length) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    logger.error('sendPushToUser', err);
  }
}

module.exports = { sendPushToUser };
