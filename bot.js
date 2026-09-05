const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const pino = require('pino');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }) // Silencia logs molestos
  });

  sock.ev.on('creds.update', saveCreds);

  // Capturar y dibujar el código QR explícitamente
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 ESCANEÁ ESTE CÓDIGO QR CON TU WHATSAPP:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ ¡WHATSAPP CONECTADO CON ÉXITO AL CRM!');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexión cerrada. Reconectando...', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    }
  });

  // Mini servidor para el botón Enviar del CRM
  const app = express();
  app.use(express.json());

  app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    try {
      const id = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
      await sock.sendMessage(id, { text: message });
      res.send({ status: 'ok' });
    } catch (err) {
      console.error('Error al despachar:', err);
      res.status(500).send({ error: 'Fallo al enviar' });
    }
  });

  app.listen(3001, () => {
    console.log('⏳ Esperando generar código QR...');
  });
}

startBot();