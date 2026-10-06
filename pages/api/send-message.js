import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://jcnsepbalxyscxrsyade.supabase.co',
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { phone, jid, message, contactId } = req.body;

  if ((!phone && !jid) || !message) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    // 1. Guardar en Supabase para el CRM
    if (contactId) {
      await supabase.from('messages').insert([{
        contact_id: contactId,
        sender: 'me',
        text: message
      }]);
    }

    // 2. CRÍTICO: Usar el JID exacto que mandó el CRM. Si no hay, armamos uno de emergencia.
    const targetJid = jid || (phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`);

    // 3. Pegarle a Render con todos los datos correctos
    const renderRes = await fetch('https://whatsapp-server-qr.onrender.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, jid: targetJid, message, text: message })
    });

    const data = await renderRes.json().catch(() => ({}));

    if (!renderRes.ok) {
      return res.status(renderRes.status).json({ error: data.error || 'Error en Baileys' });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}