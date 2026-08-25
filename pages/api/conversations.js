// pages/api/conversations.js
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Leer base de datos
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ conversations: [] }));
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { conversations: [] };
  }
}

// Escribir base de datos
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  const db = readDB();

  // GET - Obtener todas las conversaciones
  if (req.method === 'GET') {
    // Si tiene ID, obtener una específica
    if (req.query.id) {
      const conv = db.conversations.find(c => c.id === req.query.id);
      return res.status(200).json(conv || {});
    }
    return res.status(200).json(db.conversations);
  }

  // POST - Crear nueva conversación
  if (req.method === 'POST') {
    const { phone, name, message } = req.body;
    const newConversation = {
      id: Date.now().toString(),
      phone,
      name: name || phone,
      lastMessage: message || 'Nuevo contacto',
      status: 'nuevo',
      date: new Date().toISOString(),
      unread: true,
      messages: message ? [{
        from: 'client',
        text: message,
        time: new Date().toISOString()
      }] : []
    };
    db.conversations.unshift(newConversation);
    writeDB(db);
    return res.status(201).json(newConversation);
  }

  // PATCH - Actualizar estado
  if (req.method === 'PATCH') {
    const { id } = req.query;
    const { status } = req.body;
    const conv = db.conversations.find(c => c.id === id);
    if (conv) {
      conv.status = status;
      writeDB(db);
      return res.status(200).json(conv);
    }
    return res.status(404).json({ error: 'No encontrado' });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}