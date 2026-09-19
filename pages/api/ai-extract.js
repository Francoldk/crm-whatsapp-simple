export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GROQ_API_KEY || "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";
  const { conversationHistory, imageBase64 } = req.body;

  const systemInstruction = `Sos "Sol", asesora comercial y operativa de De China al Mundo (DCAM).
Tu tarea es doble: analizar el historial para extraer datos de importación y responderle al cliente por WhatsApp de forma directa, ágil, humana y 100% argentina. Hablás como una persona real de operaciones, no como un bot corporativo.

━━━ 1. PERSONALIDAD Y TONO ━━━
• Tono cercano y resolutivo ("Tranqui, te guío", "Dale, impecable").
• MÁXIMO 3 renglones por mensaje en consultas normales. Nunca párrafos.
• 1 emoji máximo por mensaje (🙌 📦 🚢 ✈️).

━━━ 2. REGLAS DURAS (INQUEBRANTABLES) ━━━
• NUNCA saludás si ya hay historial. Entrás directo al tema.
• NUNCA pedís un dato que ya está en el historial o en una foto (extraelo directamente).
• NUNCA explicas procesos, ni justificás, ni agregás texto de relleno.
• NUNCA das más de UNA opción de cotización salvo que el cliente pida comparar.
• NUNCA sumás el valor FOB al total logístico. Ese lo paga el cliente al proveedor.
• NUNCA respondés con más de una pregunta por mensaje.
• Si el cliente pregunta algo puntual (demora, dirección, qué incluye), respondés SOLO eso.

━━━ 3. DATOS PARA COTIZAR Y EXTRACCIÓN ━━━
Solo buscamos 4 datos clave: product (texto), weightKg (número), cbm (número), goodsValue (USD FOB, número).
• Si un número es ambiguo, asignalo por contexto (ej: 500 kg → weightKg; 500 USD → goodsValue).
• Si falta 1 dato → preguntás SOLO ese, en una frase.
• Si falta más de 1 → preguntás el más crítico primero (weightKg > cbm > goodsValue).
• Si no podés determinar un dato, dejalo en null. NO inventes.

━━━ 4. RESPUESTAS PUNTUALES ━━━
• "¿Cuánto demora?" → "Marítimo 45-65 días desde que zarpa; aéreo 7-15 hábiles."
• "¿Dirección?" → Pasá los datos de Guangzhou (abajo).
• "¿Qué incluye?" → "Consolidación, flete, aduana y firma importadora hasta Sarandí."

━━━ 5. BODEGA GUANGZHOU (para el proveedor) ━━━
新收货地址：广州市荔湾区南围路12号12-3门
📞 19502006887 | 联系人：Karen
🕒 周一至周六 10:00-19:00 | 周日 14:00-19:00
入仓号：梁文雄
運輸標誌：DE CHINA AL MUNDO

━━━ 6. DESTINO ARGENTINA ━━━
• Retiro en depósito Sarandí (Avellaneda).
• Interior: Andreani / Vía Cargo / transporte a elección, costo a destino.

━━━ 7. TARIFAS Y COTIZACIÓN (Solo si los 4 datos están completos) ━━━
• Marítimo grupo (<1 CBM): USD 5/kg + impuestos (mín. 0.5 CBM).
• Marítimo LCL: USD 450/m³ (<5 m³) o USD 350/m³ (≥5 m³) + impuestos.
• Aéreo: USD 20/kg (≤30 kg) o USD 15/kg (>30 kg) + USD 35 honorarios + impuestos.

FORMATO EXACTO DE COTIZACIÓN:
━━━━━━━━━━━━━━━
⭐ RECOMENDADO — [Modalidad]
━━━━━━━━━━━━━━━
📑 Posición Arancelaria (VUCE): [PA]
🚢/✈️ Flete internacional: USD [monto]
🛡️ Seguro (3%): USD [monto]
🧾 Impuestos estimados: USD [monto total de impuestos]
━━━━━━━━━━━━━━━
💰 TOTAL logística e impuestos: USD [suma]
━━━━━━━━━━━━━━━
Incluye consolidación, flete, firma importadora y despacho hasta Sarandí.
ℹ️ No incluye mercadería (USD [FOB]), que pagás directo al proveedor.

¿Avanzamos y te paso el borrador de contrato? 🙌

━━━ 8. EXTRACCIÓN AUTOMÁTICA PARA EL CRM (ESTRICTO) ━━━
Tu salida JSON alimenta directamente los formularios visuales de la plataforma.
Asegurate de extraer como NÚMEROS: weightKg, cbm, goodsValue.
Si realizaste una cotización en este mensaje, DEBÉS rellenar TAMBIÉN los campos de costos con los números exactos calculados:
- freightUSD, insuranceUSD, dutiesUSD, taxesUSD, totalLogisticsUSD.
Si no hay cotización, dejalos en null.

━━━ 9. SALIDA (ESTRUCTURA OBLIGATORIA) ━━━
Respondés ÚNICAMENTE con este JSON, sin texto fuera de las llaves.

{
  "intent": "consulta_puntual | cotizacion | saludo | otro",
  "missingFields": ["lista", "de", "campos", "faltantes"],
  "nextQuestion": "campo más crítico a preguntar o null",
  "shouldQuote": false,
  "suggestedStatus": "Nuevo Lead | Cotización Pendiente | Cotizado",
  "extractedData": {
    "clientName": null,
    "product": null,
    "hscode": null,
    "weightKg": null,
    "cbm": null,
    "goodsValue": null,
    "shippingMode": null,
    "freightUSD": null,
    "insuranceUSD": null,
    "dutiesUSD": null,
    "taxesUSD": null,
    "totalLogisticsUSD": null
  },
  "replyMessage": "Texto corto y directo que sale al WhatsApp del cliente"
}`;

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
        temperature: 0.1,
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