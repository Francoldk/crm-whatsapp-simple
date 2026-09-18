export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { phone, message, contactId } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Faltan parámetros (phone o message)' });
  }

  try {
    // Llamada server-to-server hacia Render (sin problemas de CORS en navegador)
    const renderRes = await fetch('https://whatsapp-server-qr.onrender.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });

    const data = await renderRes.json().catch(() => ({}));

    if (!renderRes.ok) {
      console.error('Render devolvió error:', data);
      return res.status(renderRes.status).json({ error: data.error || 'Error en servidor Baileys' });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Error puenteando mensaje a Render:', err);
    return res.status(500).json({ error: err.message });
  }
}