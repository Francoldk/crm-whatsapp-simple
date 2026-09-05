let store = globalThis.__crmConversationsStore;
if (!store) {
  store = [];
  globalThis.__crmConversationsStore = store;
}

export default async function handler(req, res) {
  // Manejar CORS por si las dudas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(store);
  }

  if (req.method === 'PATCH') {
    const { phone, botActive } = req.body;
    const cleanPhone = String(phone).replace(/\D/g, '');
    const conv = store.find((c) => String(c.phone).replace(/\D/g, '') === cleanPhone);

    if (conv) {
      conv.botActive = botActive;
      return res.status(200).json({ success: true, conv });
    }
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  if (req.method === 'POST') {
    const { phone, name, text, sender, status, quoteData } = req.body;
    if (!phone) return res.status(400).json({ error: 'Falta teléfono' });

    const cleanPhone = String(phone).replace(/\D/g, '');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let conv = store.find((c) => String(c.phone).replace(/\D/g, '') === cleanPhone);

    const newMsg = {
      id: Date.now(),
      sender: sender || 'user',
      text: text || '',
      time: now
    };

    if (conv) {
      if (text) conv.messages.push(newMsg);
      conv.lastMessage = text || conv.lastMessage;
      conv.time = now;
      if (name && (!conv.name || conv.name.includes('+'))) conv.name = name;
      if (status) conv.status = status;
      if (quoteData) conv.quoteData = { ...conv.quoteData, ...quoteData };
    } else {
      conv = {
        id: cleanPhone,
        phone: cleanPhone,
        name: name || `+${cleanPhone}`,
        lastMessage: text || '',
        time: now,
        status: status || 'Nuevo Lead',
        archived: false,
        botActive: true,
        messages: text ? [newMsg] : [],
        quoteData: quoteData || {
          clientName: name || '',
          phone: cleanPhone,
          product: '',
          hscode: '',
          incoterm: 'FOB',
          goodsValue: '',
          weightKg: '',
          cbm: '',
          shippingMode: 'maritimo_compartido',
          notes: ''
        }
      };
      store.unshift(conv);
    }

    return res.status(200).json({ success: true, conversation: conv });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}