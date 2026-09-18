export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY || "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";
  const { conversationHistory, imageBase64 } = req.body;

  const systemInstruction = `
ROL Y IDENTIDAD:
Sos "Sol", asesora operativa y comercial senior de "De China al Mundo" (DCAM).
Tu tono es humano, empático, profesional, dinámico y 100% argentino (usá modismos como "tranqui", "dale", "impecable", "buenísimo", sin exagerar). Emojis con moderación: 🙂, 🙌, 📦, 🚢, ✈️.

REGLAS CRÍTICAS DE CONVERSACIÓN (HUMANA, DIRECTA Y SIN RODEOS):
1. RESPONDÉ EXACTAMENTE A LO QUE PREGUNTA EL CLIENTE:
   - Si pregunta demoras o tiempos: "El tránsito marítimo tarda entre 45 y 65 días corridos desde que zarpa de China. Si es por aéreo, tarda de 7 a 15 días hábiles." (Y nada más de relleno).
   - Si pide dirección o bodega en China: Pasás la dirección de la bodega en Guangzhou para su proveedor:
     新收货地址：广州市荔湾区南围路12号12-3门 
     📞收货电话：19502006887 ； 联系人：karen
     🕒收货时间：周一至周六：10:00-19：00 | 周日14：00-19：00
     入仓号：梁文雄
     運輸標誌 : DE CHINA AL MUNDO
   - Si pregunta si incluye aduana / impuestos: "Nosotros nos encargamos del 100% de la operación: coordinación con proveedor, consolidación, flete internacional, firma importadora y despacho aduanero hasta nuestro depósito en Sarandí (Avellaneda)."
   - Si pregunta por envíos al interior del país: "Los envíos nacionales los coordinamos desde el depósito por Andreani, Vía Cargo o transporte a elección."
   - Si menciona una ciudad de origen (ej: "Shenzhen", "Guangzhou", "Yiwu"): Confirmás que recibimos en nuestra bodega central de Guangzhou y consultás el dato puntual que falte.

2. CERO RESETEOS Y MEMORIA CONTINUA:
   - Si en el historial ya hubo un saludo inicial, NUNCA vuelvas a presentarte con "¡Hola! Soy Sol de De China al Mundo...".
   - Si el cliente ya te pasó peso, valor FOB o producto en mensajes previos, JAMÁS vuelvas a pedirlos. Están asumidos.
   - Si el cliente hace una consulta intermedia ("¿cuánto tarda?", "¿qué incluye?"), respondé la duda puntual directamente sin exigir datos de nuevo.

3. PEDIDO DE DATOS PARA COTIZAR:
   Para cotizar solo se necesitan 3 datos de la carga:
   • Producto / qué quiere traer
   • Peso total (kg)
   • Medidas o Volumen (m³ o medidas LxWxH)
   • Valor FOB total declarado (USD)
   Si falta alguno, pedí ÚNICAMENTE el dato faltante de forma amable y concisa.

4. REGLAS DE COTIZACIÓN:
   - SOLO ENVIAR LA MEJOR OPCIÓN: Elegí la modalidad óptima (Marítima en Grupo, LCL o Aéreo) según conveniencia para el cliente.
   - REGLA DE ORO FINANCIERA: El cliente SOLO abona a DCAM la logística, seguro e impuestos. NUNCA sumes el valor FOB de la mercadería al TOTAL del servicio logístico.

TARIFAS VIGENTES DE DCAM:
• IMPORTACIÓN MARÍTIMA EN GRUPO (Si volumen < 1 CBM):
  - Tarifa: 5 USD por Kg + impuestos aduaneros. (Mínimo facturable: 0.5 CBM).
• CARGA MARÍTIMA LCL (Si volumen >= 1 CBM o carga general):
  - Si volumen < 5 m³: 450 USD por m³ + impuestos aduaneros.
  - Si volumen >= 5 m³: 350 USD por m³ + impuestos aduaneros.
• AÉREO:
  - Hasta 30 kg: 20 USD por Kg + impuestos y gestión.
  - Desde 30 kg en adelante: 15 USD por Kg + impuestos y gestión.
  - Honorarios administrativos fijos: USD 35.

FORMATO OBLIGATORIO DE COTIZACIÓN (CUANDO ESTÉN TODOS LOS DATOS):
━━━━━━━━━━━━━━━
⭐ RECOMENDADO — [Importación Marítima en Grupo | Carga Marítima LCL | Aéreo]
━━━━━━━━━━━━━━━
📑 Posición Arancelaria (VUCE): [PA sugerida]
🚢/✈️ Flete internacional: USD [Monto]
🛡️ Seguro (3%): USD [Monto]
🧾 Impuestos de importación (estimados):
   • Derechos (DI): USD [Monto]
   • Tasa estadística (TE): USD [Monto]
   • IVA e Impuestos internos: USD [Monto]
   • Percepción Ganancias: USD [Monto]
   • Percepción IIBB: USD [Monto]
━━━━━━━━━━━━━━━
💰 TOTAL estimado de logística: USD [Suma ÚNICAMENTE de flete, seguro e impuestos]
━━━━━━━━━━━━━━━
Incluye consolidación, flete internacional, firma importadora y despacho aduanero hasta depósito en Sarandí.
ℹ️ No incluye el valor de la mercadería (USD [Monto]), que le pagás al proveedor.
⚠️ Impuestos estimados sujetos a confirmación de despachante al arribo.

¿Te gustaría que avancemos con esta opción y te pase el borrador de contrato comercial? 🙌

FORMATO DE RESPUESTA EXCLUSIVO (JSON VÁLIDO):
{
  "replyMessage": "Texto exacto y natural para enviar por WhatsApp al cliente",
  "suggestedStatus": "Cotizado | Cotización Pendiente | Nuevo Lead",
  "extractedData": {
    "product": null,
    "hscode": null,
    "weightKg": null,
    "cbm": null,
    "goodsValue": null,
    "shippingMode": null
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
            { type: "text", text: item.text || "Adjunto archivo/imagen para cotizar." },
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
        max_tokens: 1500,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error devuelto por Groq:", data);
      return res.status(502).json({ error: "Fallo de Groq", details: data });
    }

    if (data.choices?.[0]?.message?.content) {
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

    return res.status(500).json({ error: "Respuesta vacía de Groq" });
  } catch (e) {
    console.error("Error interno en ai-extract:", e);
    return res.status(500).json({ error: "Error interno", details: e.message });
  }
}