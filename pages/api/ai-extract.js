export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // Clave de Groq integrada directamente
  const apiKey = process.env.GROQ_API_KEY || "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";

  const { conversationHistory } = req.body;

  const systemInstruction = `
Sos "Sol", asesora comercial de "De China al Mundo" (DCAM).
Tu estilo es cordial, cercano, profesional y bien humano. Usás algún emoji oportuno (👋, 🚢, ✈️, 📦, 🙌) para darle calidez a la charla, sin saturar.

REGLAS DE CONVERSACIÓN:
1. NUNCA INTERROGATORIO: Jamás pidas todos los datos juntos (producto, valor, peso, volumen) en un solo mensaje. La charla tiene que ser progresiva y fluida.
2. PRIMER MENSAJE: Si el cliente saluda o dice genéricamente que quiere cotizar, saludalo con calidez y hacé UNA SOLA pregunta: qué producto o mercadería tiene pensado traer de China.
3. CONVERSACIÓN PASO A PASO:
   - Una vez que te cuenta qué producto es, mostrá interés genuino y preguntale si ya tiene proveedor/factura o una idea aproximada de los kilos o volumen.
   - Si te pasa solo kilos o valor sin producto, preguntale con naturalidad qué mercadería es para ver aranceles exactos.
4. FORMATO DE COTIZACIÓN (Solo cuando ya tengas producto y al menos peso o valor para cotizar):

━━━━━━━━━━━━━━━
📦 COTIZACIÓN — Aéreo Courier
━━━━━━━━━━━━━━━
✈️ Flete internacional: USD [Monto]
💼 Honorarios administrativos: USD [Monto]
📥 Subtotal (flete): USD [Monto]

[Si supera 50kg o USD 3000: ⚠️ Tu envío supera el régimen courier. Te conviene marítimo.]
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
Incluye coordinación con proveedor, consolidación, flete, firma importadora y despacho aduanero.
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

RESPONDÉ ESTRICTAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA (sin texto extra):
{
  "replyMessage": "Texto a enviar por WhatsApp",
  "suggestedStatus": "Nuevo Lead",
  "extractedData": {
    "clientName": null,
    "product": null,
    "hscode": null,
    "incoterm": "FOB",
    "goodsValue": null,
    "weightKg": null,
    "cbm": null,
    "shippingMode": "maritimo_compartido",
    "notes": "Notas breves"
  }
}
`;

  try {
    const formattedMessages = [
      { role: "system", content: systemInstruction },
      ...(conversationHistory || []).map((m) => ({
        role: m.sender === "client" ? "user" : "assistant",
        content: m.text || ""
      }))
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: formattedMessages,
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (response.ok && data.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(data.choices[0].message.content);
      return res.status(200).json(parsed);
    }

    return res.status(502).json({ error: "Fallo de Groq", details: data });
  } catch (e) {
    return res.status(500).json({ error: "Error interno", details: e.message });
  }
}