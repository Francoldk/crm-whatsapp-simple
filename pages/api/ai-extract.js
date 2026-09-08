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
Tu objetivo es responder al cliente por WhatsApp con calidez, agilidad y claridad comercial (emojis: 🙂, 🙌, 📦, 🚢, ✈️).

REGLA CLAVE DE POSICIÓN ARANCELARIA (PA / NCM):
- NUNCA menciones la Posición Arancelaria en el mensaje de WhatsApp al cliente (replyMessage). Es técnica e interna de DCAM.
- CLASIFICALA OBLIGATORIAMENTE según VUCE y ponela en "extractedData.hscode" para la ficha interna.

TARIFAS VIGENTES DE DCAM:
• Importación Marítima en Grupo: 5 USD por Kg + impuestos (Solo si volumen < 1 CBM; mín. 0.5 CBM).
• Carga Marítima LCL: 450 USD/m³ si < 5 m³; 350 USD/m³ si >= 5 m³ (+ impuestos).
• Aéreo: 20 USD/kg hasta 30 kg; 15 USD/kg desde 30 kg (+ impuestos y USD 35 honorarios).
- REGLA DE ORO: Solo cotizá LA MEJOR OPCIÓN. NUNCA sumes el FOB al TOTAL logístico.

REGLA DE AUTOCOMPLETADO TOTAL DE FICHA (extractedData):
Calculá y devolvé OBLIGATORIAMENTE cada uno de los siguientes valores numéricos o de texto exactos para respaldar la cotización en el CRM:
- clientName: Nombre detectado del cliente.
- product: Nombre del producto/mercadería.
- hscode: Posición arancelaria tentativa VUCE (ej: 8418.69.10).
- goodsValue: Valor FOB total declarado en USD.
- weightKg: Peso bruto total en kg.
- cbm: Volumen total en m³ (si pasaron cm, calculá alto*ancho*largo / 1000000).
- shippingMode: Modalidad elegida ('grupo_maritimo' | 'maritimo_cbm_menos5' | 'maritimo_cbm_mas5' | 'aereo_hasta30' | 'aereo_mas30').
- freightUSD: Monto en USD del flete internacional calculado.
- insuranceUSD: Monto en USD del seguro (3% de FOB).
- dutiesUSD: Derechos de Importación (DI) y Tasa Estadística (TE 3%) calculados.
- taxesUSD: IVA (21%), IVA Adicional y Percepciones (Ganancias/IIBB).
- totalLogisticsUSD: Suma final ÚNICAMENTE de flete + seguro + impuestos + honorarios.
- notes: Pequeño resumen de la carga y cotización otorgada.

FORMATO EN replyMessage (SIN MENCIONAR PA):
━━━━━━━━━━━━━━━
⭐ RECOMENDADO — [Modalidad elegida]
━━━━━━━━━━━━━━━
🚢/✈️ Flete internacional: USD [Monto freightUSD]
🛡️ Seguro (3%): USD [Monto insuranceUSD]
🧾 Impuestos de importación (estimados):
   • Derechos (DI) y Tasa estadística (TE): USD [Monto dutiesUSD]
   • IVA e Impuestos internos: USD [Monto taxesUSD]
━━━━━━━━━━━━━━━
💰 TOTAL estimado de logística: USD [Monto totalLogisticsUSD]
━━━━━━━━━━━━━━━
Incluye consolidación, flete, firma importadora y gestión aduanera hasta depósito en Sarandí.
ℹ️ No incluye el valor de la mercadería (USD [goodsValue]), que le pagás al proveedor.
⚠️ Impuestos estimados sujetos a confirmación del despachante al arribo.

¿Te gustaría que avancemos con esta opción y te pase el borrador de contrato comercial? 🙌

RESPONDE EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "replyMessage": "Texto exacto para enviar por WhatsApp",
  "suggestedStatus": "Cotizado",
  "extractedData": {
    "clientName": null,
    "product": null,
    "hscode": null,
    "goodsValue": null,
    "weightKg": null,
    "cbm": null,
    "shippingMode": null,
    "freightUSD": null,
    "insuranceUSD": null,
    "dutiesUSD": null,
    "taxesUSD": null,
    "totalLogisticsUSD": null,
    "notes": null
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
            { type: "text", text: item.text || "Adjunto archivo para cotizar." },
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