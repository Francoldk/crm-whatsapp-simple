import { createClient } from '@supabase/supabase-js';

// Conectamos con Supabase para guardar todo de forma permanente
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://jcnsepbalxyscxrsyade.supabase.co',
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET: Devolver contactos desde Supabase (por si tu UI lo usa)
  if (req.method === "GET") {
    const { data, error } = await supabase.from('contacts').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // PATCH: Actualizaciones rápidas (Estado o Pausa de Sol)
  if (req.method === "PATCH") {
    const { phone, botActive, status, quoteData } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    try {
      const { data: contact } = await supabase.from('contacts').select('*').eq('phone', cleanPhone).maybeSingle();
      if (!contact) return res.status(404).json({ error: "Conversación no encontrada" });

      const updates = {};
      if (typeof botActive === 'boolean') updates.bot_active = botActive;
      if (status) updates.status = status;
      if (quoteData) {
        updates.quote_data = { ...(contact.quote_data || {}), ...quoteData };
      }

      await supabase.from('contacts').update(updates).eq('id', contact.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Acá es donde Render nos manda los mensajes nuevos de WhatsApp
  if (req.method === "POST") {
    const { phone, name, text, sender, extractedData, status } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    if (!cleanPhone) return res.status(400).json({ error: "Falta el número de teléfono" });

    try {
      // 1. Buscamos si el contacto ya existe en tu Supabase
      let { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      // 2. Si no existe, lo creamos
      if (!contact) {
        const { data: newContact, error: insertErr } = await supabase
          .from('contacts')
          .insert([{
            phone: cleanPhone,
            name: name || `+${cleanPhone}`,
            status: status || "Nuevo Lead",
            quote_data: extractedData || {},
            last_message: text || '',
            bot_active: true
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;
        contact = newContact;
      } else {
        // 3. Si ya existe, le actualizamos la data (nombre, ficha de cotización)
        let newQuoteData = contact.quote_data || {};
        if (extractedData && typeof extractedData === 'object') {
          const validEntries = Object.entries(extractedData).filter(([_, v]) => v !== null && v !== undefined && v !== '');
          newQuoteData = { ...newQuoteData, ...Object.fromEntries(validEntries) };
        }

        await supabase
          .from('contacts')
          .update({
            name: (name && name !== `+${cleanPhone}`) ? name : contact.name,
            status: status || contact.status,
            quote_data: newQuoteData,
            last_message: text || contact.last_message,
            updated_at: new Date().toISOString() // forzamos actualizar la fecha
          })
          .eq('id', contact.id);
      }

      // 4. Guardamos el mensaje nuevo en la tabla de messages
      if (text) {
        await supabase
          .from('messages')
          .insert([{
            contact_id: contact.id,
            sender: sender || 'client',
            text: text
          }]);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error en webhook POST:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}