// Base de datos en memoria / persistencia de webhook
let conversationsStore = [];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET: Consultar todas las conversaciones
  if (req.method === "GET") {
    return res.status(200).json(conversationsStore);
  }

  // PATCH: Actualizaciones rápidas (Estado o Pausa de Sol)
  if (req.method === "PATCH") {
    const { phone, botActive, status, quoteData } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const conv = conversationsStore.find((c) => String(c.phone) === cleanPhone);

    if (conv) {
      if (typeof botActive === 'boolean') conv.botActive = botActive;
      if (status) conv.status = status;
      if (quoteData) {
        conv.quoteData = { ...(conv.quoteData || {}), ...quoteData };
      }
      return res.status(200).json({ success: true, conversation: conv });
    }
    return res.status(404).json({ error: "Conversación no encontrada" });
  }

  // POST: Registro de mensajes y guardado de ficha
  if (req.method === "POST") {
    const { phone, name, text, sender, extractedData, status } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    if (!cleanPhone) {
      return res.status(400).json({ error: "Falta el número de teléfono" });
    }

    let conv = conversationsStore.find((c) => String(c.phone) === cleanPhone);

    if (!conv) {
      conv = {
        id: cleanPhone,
        phone: cleanPhone,
        name: name || `+${cleanPhone}`,
        status: status || "Nuevo Lead",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        lastMessage: text || '',
        messages: [],
        quoteData: {},
        botActive: true,
        archived: false
      };
      conversationsStore.unshift(conv);
    }

    // Actualizar nombre si viene especificado
    if (name && name !== `+${cleanPhone}`) {
      conv.name = name;
    }

    // FUSIÓN ESTRICTA DE FICHA: Jamás sobreescribir con vacío
    if (extractedData && typeof extractedData === 'object') {
      const validEntries = Object.entries(extractedData).filter(
        ([_, v]) => v !== null && v !== undefined && v !== ''
      );
      conv.quoteData = {
        ...(conv.quoteData || {}),
        ...Object.fromEntries(validEntries)
      };
    }

    if (status) {
      conv.status = status;
    }

    // Agregar mensaje si viene texto
    if (text) {
      conv.lastMessage = text;
      conv.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      conv.messages.push({
        id: Date.now(),
        sender: sender || 'client',
        text: text,
        time: conv.time
      });
    }

    return res.status(200).json({ success: true, conversation: conv });
  }

  return res.status(405).json({ error: "Método no permitido" });
}