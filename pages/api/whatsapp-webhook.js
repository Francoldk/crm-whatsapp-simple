// Almacén en memoria compartida para pruebas
if (!global.crmConversations) {
  global.crmConversations = [
    {
      id: '5493512345678',
      name: 'Distribuidora San Vicente',
      phone: '5493512345678',
      lastMessage: 'Hola Franco, me podés pasar el costo de 40 cubiertas puestas en Córdoba?',
      time: '11:20',
      status: 'Cotización Pendiente',
      archived: false,
      quoteData: {
        clientName: 'Distribuidora San Vicente',
        phone: '5493512345678',
        product: 'Cubiertas / Neumáticos rodado 14',
        hscode: '4011.10.00',
        incoterm: 'FOB',
        goodsValue: '4200',
        weightKg: '380',
        cbm: '2.4',
        shippingMode: 'maritimo_compartido',
        notes: 'Cliente busca traer consolidado.'
      },
      messages: [
        { id: 101, sender: 'client', text: 'Hola Franco, cómo estás?', time: '11:15' },
        { id: 102, sender: 'client', text: 'Me podés pasar el costo de 40 cubiertas puestas en Córdoba? Son 380kg y 2.4 CBM por 4200 USD FOB.', time: '11:20' }
      ]
    }
  ];
}

export default async function handler(req, res) {
  // 1. EL FRONTEND CONSULTA LOS MENSAJES (GET)
  if (req.method === 'GET') {
    return res.status(200).json(global.crmConversations);
  }

  // 2. EL BOT DE WHATSAPP ENVÍA UN MENSAJE (POST)
  if (req.method === 'POST') {
    const { phone, name, text, imageBase64, imageMimeType } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Falta el número de teléfono' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const clientName = name || `Lead +${cleanPhone}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Buscar si ya existe la conversación o crear una nueva
    let conv = global.crmConversations.find((c) => c.phone === cleanPhone);

    if (!conv) {
      conv = {
        id: cleanPhone,
        name: clientName,
        phone: cleanPhone,
        lastMessage: text || '[Archivo adjunto]',
        time: nowTime,
        status: 'Nuevo Lead',
        archived: false,
        quoteData: {
          clientName: clientName,
          phone: cleanPhone,
          product: '',
          hscode: '',
          incoterm: 'FOB',
          goodsValue: '',
          weightKg: '',
          cbm: '',
          shippingMode: 'maritimo_compartido',
          notes: ''
        },
        messages: []
      };
      global.crmConversations.unshift(conv);
    }

    // Agregar mensaje del cliente
    conv.messages.push({
      id: Date.now(),
      sender: 'client',
      text: text || '[Foto enviada]',
      time: nowTime
    });
    conv.lastMessage = text || '[Foto enviada]';
    conv.time = nowTime;

    let solReply = null;

    try {
      // Invocamos a Sol
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const aiUrl = `${protocol}://${host}/api/ai-extract`;

      const aiRes = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conv.messages,
          imageBase64,
          imageMimeType
        })
      });

      const aiData = await aiRes.json();

      if (aiData.replyMessage) {
        solReply = aiData.replyMessage;
        // Guardar mensaje de Sol en el historial del CRM
        conv.messages.push({
          id: Date.now() + 1,
          sender: 'me',
          text: solReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        conv.lastMessage = solReply;
      }

      if (aiData.extractedData) {
        conv.quoteData = {
          ...conv.quoteData,
          ...Object.fromEntries(
            Object.entries(aiData.extractedData).filter(([_, v]) => v !== null && v !== '')
          )
        };
      }

      if (aiData.suggestedStatus) {
        conv.status = aiData.suggestedStatus;
      }
    } catch (err) {
      console.error('Error al procesar con Sol:', err.message);
    }

    return res.status(200).json({
      success: true,
      replyMessage: solReply,
      extractedData: conv.quoteData
    });
  }

  return res.status(405).end();
}