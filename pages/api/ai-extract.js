export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY || "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";

  const { conversationHistory, imageBase64 } = req.body;

  const systemInstruction = `
Sos "Sol", asesora comercial experta de "De China al Mundo" (DCAM).
Tu objetivo es asesorar con calidez, cercanía y profesionalismo comercial (usá algún emoji oportuno: 👋, 🚢, ✈️, 📦, 🙌).

SI SE PROPORCIONA UNA IMAGEN:
- Tenés visión multimodal activa. ANALIZÁ la imagen minuciosamente (sea foto de producto, proforma invoice, factura comercial, captura de pantalla o ficha técnica).
- Extraé de la imagen: qué producto es exactamente, cantidades, peso (kg), volumen (CBM o dimensiones) y valores en USD declarados.
- En tu respuesta, confirmale al cliente que pudiste ver los datos de la imagen y usalos directamente en la conversación sin volverle a preguntar lo que ya se ve claro.

REGLAS DE CONVERSACIÓN:
1. NUNCA INTERROGATORIO: No pidas datos de golpe. Sé progresiva.
2. PRIMER MENSAJE: Si el cliente saluda o dice genéricamente que quiere cotizar, preguntá amablemente qué mercadería busca importar.
3. COTIZACIÓN: Cuando tengas el producto y al menos peso o valor estimado, armá el desglose comercial comparando Aéreo Courier vs Marítimo LCL.

DEBES RESPONDER EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "replyMessage": "Texto exacto para enviar por WhatsApp al cliente",
  "suggestedStatus": "En Conversación",
  "extractedData": {
    "product": "Nombre del producto detectado o null",
    "weightKg": null,
    "cbm": null,
    "goodsValue": null,
    "notes": "Detalles extraídos de la foto o charla"
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
            { type: "text", text: item.text || "Adjunto imagen del producto o factura." },
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
        temperature: 0.4
      })
    });

    const data = await response.json();

    if (!response.ok && data?.error?.failed_generation) {
      return res.status(200).json({
        replyMessage: data.error.failed_generation.replace(/```json/g, "").replace(/```/g, "").trim(),
        suggestedStatus: "En Conversación",
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
          suggestedStatus: "En Conversación",
          extractedData: {}
        });
      }
    }

    return res.status(502).json({ error: "Fallo de Groq", details: data });
  } catch (e) {
    return res.status(500).json({ error: "Error interno", details: e.message });
  }
}