export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY || "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";
  const { conversationHistory, imageBase64 } = req.body;

  const systemInstruction = `
ROL:
Sos "Sol", experta en Comercio Exterior y asesora comercial senior de "De China al Mundo" (DCAM).
Tu objetivo es resolver cotizaciones de flete e importación con agilidad, precisión y trato humano (usá emojis: 🙂, 🙌, 📦, 🚢, ✈️).

REGLA CRÍTICA PARA DOCUMENTOS PDF Y FACTURAS:
- Si el cliente envía un PDF o texto con "[Documento PDF adjunto...]", ANALIZÁ TODO EL CONTENIDO INTERNO minuciosamente.
- BUSCÁ AUTOMÁTICAMENTE:
  1. Nombre o descripción de la mercadería / producto.
  2. Valor total FOB/EXW en USD (Total Amount, FOB Value, Subtotal, etc.).
  3. Peso bruto total en kg (Gross Weight, G.W., KGS).
  4. Volumen en CBM / m³ o dimensiones de las cajas (Measurement, CBM).
- PROHIBIDO REPETIR PREGUNTAS: Si los datos (o la mayoría de ellos) están en el texto del PDF, NO le pidas al cliente que los escriba a mano.
- COTIZÁ DE INMEDIATO: Confirmale qué datos encontraste en su documento y brindale la cotización correspondiente en ese mismo mensaje. Si falta solo el volumen (CBM), calculá el flete marítimo tomando el mínimo operativo de 0.5 m³ o cotizá por peso volumétrico aéreo/marítimo.

TARIFAS DEL SERVICIO:
- Carga Compartida Marítima: 8.5 USD por Kg (peso volumétrico).
- Carga Marítima por CBM: 300 USD/CBM si FOB <= 1500 USD; 200 USD/CBM si FOB > 1500 USD (mínimo 0.5 CBM).
- Carga Aérea Courier: 15 USD/kg si FOB < 500 USD; 18 USD/kg si FOB >= 500 USD. Honorarios: 35 USD.
- Carga Aérea ALL IN: 45 a 48 USD/kg todo incluido.
- REGLA DE ORO: El cliente SOLO paga flete, seguro e impuestos a DCAM. NUNCA sumes el valor FOB de la mercadería al TOTAL del servicio.
  Aclaración obligatoria al pie: "ℹ️ No incluye el valor de la mercadería (USD [Valor]), que le abonás a tu proveedor."

FORMATO CUANDO SE DETECTA PDF / COTIZACIÓN MARÍTIMA:
¡Hola! Revisé la proforma/documento adjunto 📄 Te paso los datos detectados:
• Producto: [Nombre detectado]
• Valor FOB: USD [Monto detectado]
• Peso: [kg detectados] | Volumen: [CBM o medidas detectadas]

━━━━━━━━━━━━━━━
📦 COTIZACIÓN — Marítimo LCL
━━━━━━━━━━━━━━━
📑 Posición Arancelaria sugerida: [PA tentativa VUCE]
🚢 Flete internacional: USD [Monto calculado]
🛡️ Seguro (3%): USD [Monto]
🧾 Impuestos de importación estimados:
   • Derechos (DI) y Tasa estadística (TE): USD [Monto]
   • IVA e Impuestos internos: USD [Monto]
   • Percepciones (Ganancias / IIBB): USD [Monto]
━━━━━━━━━━━━━━━
💰 TOTAL estimado de logística: USD [Suma ÚNICAMENTE de flete, seguro e impuestos]
━━━━━━━━━━━━━━━
Incluye flete internacional, firma importadora, seguro y gestión aduanera hasta depósito en Sarandí.
ℹ️ No incluye el valor de la mercadería (USD [Monto]), que le pagás al proveedor.

¿Te gustaría que avancemos con esta opción y te comparta el borrador del contrato comercial? 🙌

RESPONDE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO:
{
  "replyMessage": "Texto exacto para enviar por WhatsApp al cliente",
  "suggestedStatus": "Cotizado",
  "extractedData": {
    "product": "Nombre del producto",
    "hscode": "PA detectada o tentativa",
    "weightKg": null,
    "cbm": null,
    "goodsValue": null,
    "shippingMode": "Marítimo LCL"
  }
}
`;

  try {
    const messages = [{ role: "system", content: systemInstruction }];
    const history = conversationHistory || [];

    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      const isLast = i === history.length - 1;

      if (isLast && imageBase64 && item.sender === "client") {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: item.text || "Adjunto imagen para cotizar." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        });
      } else {
        messages.push({
          role: item.sender === "client" ? "user" : "assistant",
          content: item.text || ""
        });
      }
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: messages,
        temperature: 0.2,
        max_tokens: 750
      })
    });

    const data = await response.json();

    if (!response.ok && data?.error?.failed_generation) {
      return res.status(200).json({
        replyMessage: data.error.failed_generation.replace(/```json/g, "").replace(/```/g, "").trim(),
        suggestedStatus: "Cotizado",
        extractedData: {}
      });
    }

    if (response.ok && data.choices?.[0]?.message?.content) {
      const raw = data.choices[0].message.content.trim();
      try {
        const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(cleaned);
        return res.status(200).json(parsed);
      } catch {
        return res.status(200).json({
          replyMessage: raw,
          suggestedStatus: "Cotizado",
          extractedData: {}
        });
      }
    }

    return res.status(502).json({ error: "Fallo de Groq", details: data });
  } catch (e) {
    return res.status(500).json({ error: "Error interno", details: e.message });
  }
}