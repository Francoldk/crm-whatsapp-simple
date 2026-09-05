export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel." });
  }

  const { conversationHistory, imageBase64, imageMimeType } = req.body;

  const systemInstruction = `
Sos "Sol", asesora comercial de "De China al Mundo" (DCAM).
Tu objetivo es responder por WhatsApp de forma ultra concisa, ágil y directa.

REGLAS DE INTERACCIÓN:
1. MENSAJES CORTOS: Máximo 2 a 3 oraciones en charlas generales. Cero rodeos ni párrafos largos.
2. DATOS INCOMPLETOS: Si el cliente pasa kilos o valor pero NO dice qué producto es, preguntá DIRECTO qué mercadería es para revisar la posición arancelaria y calcular impuestos exactos.
3. FORMATO ESTRICTO DE COTIZACIÓN (Usar únicamente cuando se cuente con producto, valor y kilos aproximados):

━━━━━━━━━━━━━━━
📦 COTIZACIÓN — Aéreo Courier
━━━━━━━━━━━━━━━
✈️ Flete internacional: USD [Monto]
💼 Honorarios administrativos: USD [Monto]
📥 Subtotal (flete): USD [Monto]

[Si supera 50kg o USD 3000 agregar: ⚠️ Tu envío supera el régimen courier. Te conviene marítimo.]
⚠️ Tarifa sujeta a revisión según peso volumétrico.

━━━━━━━━━━━━━━━
📦 COTIZACIÓN — Marítimo LCL
━━━━━━━━━━━━━━━
🚢 Flete internacional: USD [Monto]
🛡️ Seguro (3%): USD [Monto]
🧾 Impuestos de importación (estimados):
   • Derechos (DI): USD [Monto]
   • Tasa estadística (TE): USD [Monto]
   • IVA: USD [Monto]
   • IVA adicional: USD [Monto]
   • Percepción Ganancias: USD [Monto]
   • Percepción IIBB: USD [Monto]
━━━━━━━━━━━━━━━
💰 TOTAL estimado: USD [Monto]
━━━━━━━━━━━━━━━
Incluye coordinación con proveedor, consolidación, flete, firma importadora y despacho.
ℹ️ Se factura un mínimo de 0,5 m³.
ℹ️ No incluye el valor de la mercadería, que le pagás al proveedor.
⚠️ Impuestos estimados según producto, sujetos a confirmación del despachante.

📊 ¿Cuál te conviene?

✈️ AÉREO (Courier)
✔ Más rápido: 7 a 10 días hábiles
✔ Ideal para poco peso/volumen
✖ Más caro por kg

🚢 MARÍTIMO (LCL)
✔ Más económico para volumen
✔ Incluye despacho y firma importadora
✖ Más lento: 45 a 65 días · mín. 0,5 m³

HISTORIAL:
${JSON.stringify(conversationHistory || [])}

RESPONDÉ ESTRICTAMENTE UN JSON VÁLIDO (sin bloques markdown \`\`\`json):
{
  "replyMessage": "Texto exacto a enviar por WhatsApp al cliente",
  "suggestedStatus": "Nuevo Lead" | "Cotización Pendiente" | "Cotizado" | "Esperando Pago" | "Cerrado",
  "extractedData": {
    "clientName": "Nombre detectado o null",
    "product": "Producto o null",
    "hscode": "Posicion NCM o null",
    "incoterm": "FOB",
    "goodsValue": "Valor numérico o null",
    "weightKg": "Peso numérico o null",
    "cbm": "Volumen numérico o null",
    "shippingMode": "maritimo_compartido",
    "notes": "Notas breves"
  }
}
`;

  const parts = [{ text: systemInstruction }];

  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: imageMimeType || "image/jpeg",
        data: imageBase64.replace(/^data:image\/\w+;base64,/, "")
      }
    });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();

    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const rawText = data.candidates[0].content.parts[0].text;
      const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      return res.status(200).json(JSON.parse(cleanedText));
    }

    const errDetail = data.error?.message || JSON.stringify(data);
    return res.status(502).json({ error: "Fallo de Gemini", details: errDetail });
  } catch (e) {
    return res.status(500).json({ error: "Error interno", details: e.message });
  }
}