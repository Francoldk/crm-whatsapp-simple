export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { phone, message } = req.body;

  try {
    // Le manda la orden al bot que está corriendo en el puerto 3001
    const response = await fetch('http://localhost:3001/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });

    if (response.ok) {
      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ error: 'Error interno del bot' });
    }
  } catch (error) {
    res.status(500).json({ error: 'El bot local no está corriendo. Ejecutá node bot.js' });
  }
}