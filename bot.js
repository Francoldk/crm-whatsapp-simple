const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const pino = require('pino');

const CRM_WEBHOOK_URL = 'https://crm-dcam-produccion.vercel.app/api/whatsapp-webhook';
const AI_EXTRACT_URL = 'https://crm-dcam-produccion.vercel.app/api/ai-extract';

let sockInstance = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sockInstance = sock;

  sock.ev.on('creds.update', saveCreds);

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
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Conexión cerrada (${statusCode || 'error'}). Reconectando en 5s...`, shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || msg.key.fromMe) return;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.includes('status')) return;

      const cleanPhone = remoteJid.replace(/\D/g, '');
      const clientName = msg.pushName || `+${cleanPhone}`;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!text.trim()) return;

      console.log(`📩 Mensaje entrante de ${clientName} (${cleanPhone}): ${text}`);

      // 1. Guardar mensaje entrante en el CRM
      const res = await fetch(CRM_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          name: clientName,
          text: text,
          sender: 'client'
        })
      });

      const data = await res.json();
      const conv = data?.conversation;

      // 2. Si Sol está pausada para este chat, cortar acá
      if (conv && conv.botActive === false) {
        console.log(`⏸️ Sol está pausada para ${clientName}. Atención manual.`);
        return;
      }

      // 3. Consultar a Sol (Gemini AI)
      console.log(`🤖 Sol generando respuesta para ${clientName}...`);
      const aiRes = await fetch(AI_EXTRACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conv?.messages || [{ sender: 'client', text }]
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData.replyMessage) {
          await sock.sendMessage(remoteJid, { text: aiData.replyMessage });

          await fetch(CRM_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: cleanPhone,
              text: aiData.replyMessage,
              sender: 'me'
            })
          });
          console.log(`✅ Sol respondió a ${clientName}`);
        }
      } else {
        const errText = await aiRes.text();
        console.error('❌ Error devuelto por el endpoint de IA:', errText);
      }
    } catch (error) {
      console.error('Error al procesar mensaje entrante:', error);
    }
  });
}

// Servidor Express
const app = express();
app.use(express.json());

app.post('/send', async (req, res) => {
  const { phone, message } = req.body;
  try {
    if (!sockInstance) {
      return res.status(503).json({ error: 'WhatsApp no conectado' });
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const id = `${cleanPhone}@s.whatsapp.net`;
    await sockInstance.sendMessage(id, { text: message });

    await fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        text: message,
        sender: 'me'
      })
    }).catch(() => {});

    res.send({ status: 'ok' });
  } catch (err) {
    console.error('Error al despachar mensaje:', err);
    res.status(500).send({ error: 'Fallo al enviar' });
  }
});

app.listen(3001, () => {
  console.log('🚀 Servidor local de despacho activo en puerto 3001');
  connectToWhatsApp();
});