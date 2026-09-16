import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://jcnsepbalxyscxrsyade.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_kVLvltX-K4yGF2VRPaGDaA_KBkmT78W';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === 'GET') {
    try {
      // 1. Traer contactos
      const { data: contacts, error: errContacts } = await supabase
        .from('contacts')
        .select('*');

      if (errContacts) {
        console.error('Error contactos:', errContacts);
        return res.status(500).json({ error: errContacts.message });
      }

      // 2. Traer mensajes sin forzar created_at (por si la columna tiene otro nombre)
      const { data: messages, error: errMsgs } = await supabase
        .from('messages')
        .select('*');

      if (errMsgs) {
        console.warn('Advertencia leyendo messages:', errMsgs.message);
      }

      const allMessages = messages || [];

      // 3. Formatear y asociar mensajes a cada contacto
      const formatted = (contacts || []).map((c) => {
        const cMessages = allMessages
          .filter((m) => String(m.contact_id) === String(c.id))
          .map((m) => ({
            id: m.id || Date.now(),
            sender: m.sender === 'client' ? 'client' : 'me',
            text: m.text || '',
            time: m.created_at 
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (m.timestamp || '')
          }));

        return {
          id: String(c.id),
          phone: (c.phone || '').replace(/\D/g, ''),
          name: c.name || c.phone || 'Contacto',
          status: c.status || 'Nuevo Lead',
          time: c.updated_at 
            ? new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            : '',
          lastMessage: c.last_message || (cMessages[cMessages.length - 1]?.text) || '',
          messages: cMessages,
          quoteData: c.quote_data || {},
          botActive: c.bot_active !== false,
          archived: c.archived || false
        };
      });

      return res.status(200).json(formatted);
    } catch (error) {
      console.error('Fallo en conversations.js:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, quoteData, botActive, archived } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta el id del contacto' });

    try {
      const updatePayload = {};
      if (status) updatePayload.status = status;
      if (typeof botActive === 'boolean') updatePayload.bot_active = botActive;
      if (typeof archived === 'boolean') updatePayload.archived = archived;
      if (quoteData) updatePayload.quote_data = quoteData;

      const { data, error } = await supabase
        .from('contacts')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, contact: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}