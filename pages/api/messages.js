// pages/api/messages.js
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { conversations: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { conversationId, text } = req.body;
  const db = readDB();
  const conversation = db.conversations.find(c => c.id === conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  conversation.messages.push({
    from: 'me',
    text: text,
    time: new Date().toISOString()
  });
  conversation.lastMessage = text;
  conversation.date = new Date().toISOString();

  writeDB(db);
  res.status(200).json({ success: true });
}