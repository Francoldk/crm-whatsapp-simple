import { createClient } from '@supabase/supabase-js';

// Conectamos con Supabase para registrar el historial
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://jcnsepbalxyscxrsyade.supabase.co',
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { phone, message, contactId } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Faltan parámetros (phone o message)' });
  }

  try {
    // 1. Guardar en Supabase para que quede registrado en tu CRM visualmente
    if (contactId) {
      const { error: dbError } = await supabase
        .from('messages')
        .insert([{
          contact_id: contactId,
          sender: 'me',
          text: message
        }]);
      if (dbError) console.error("Error al guardar en Supabase:", dbError);
    }

    // 2. Armar el identificador JID por si Render usa el formato estricto de Baileys
    const jid = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;

    // 3. Pegarle a tu servidor de WhatsApp en Render con todos los datos
    const renderRes = await fetch('https://whatsapp-server-qr.onrender.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Enviamos ambos formatos para asegurar que Render lo acepte sí o sí
      body: JSON.stringify({ phone, message, jid, text: message })
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