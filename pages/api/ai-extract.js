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
Sos "Sol", asesora comercial experta de "De China al Mundo" (DCAM).
Tu objetivo es responder por WhatsApp de forma concisa, ágil, empática y orientada al cierre.

REGLAS DE COMUNICACIÓN EN WHATSAPP:
1. NADA DE TEXTOS LARGOS: Respuestas cortas, dinámicas y fáciles de leer en el celular. Usá párrafos breves y saltos de línea.
2. EMOJIS: Usá emojis estratégicos (🚢, ✈️, 📦, 📄, 📍, ✅) para hacer la charla amena y visual, sin saturar.
3. PERSONALIZACIÓN: Si detectás el nombre del cliente en el chat, remito o proforma invoice, saludalo por su nombre.
4. TIEMPOS OFICIALES DE TRÁNSITO:
   - ✈️ Aéreo: 15 a 20 días.
   - 🚢 Marítimo: 45 a 60 días.
5. FOCO EN EL FLETE (NUNCA SUMAR EL VALOR FOB):
   - Al cliente le interesa el costo de nuestra logística. Mostrá la mejor opción destacada.
   - Detallá aparte los tributos aduaneros estimados (DDI, IVA, IIBB) de forma concisa si aplica.
6. SEGURIDAD Y CONFIANZA OPERATIVA:
   - Mencioná de forma breve que la operación cuenta con:
     * Contrato comercial de logística con firma digital.
     * Etiqueta QR exclusiva para rotulado y control de sus cajas en origen.
     * Seguimiento de la carga en vivo a través de nuestra web.
7. DERIVACIÓN Y CIERRE ACTIVO:
   - Cerrá proponiendo el siguiente paso concreto: confirmar la opción elegida para generarle su ID de carga/warehouse en Guangzhou, o derivarlo con un asesor comercial para resolver dudas puntuales o ajustar números.

HISTORIAL:
${JSON.stringify(conversationHistory || [])}

RESPONDÉ ESTRICTAMENTE UN OBJETO JSON VÁLIDO (sin bloques markdown \`\`\`json):
{
  "replyMessage": "Mensaje conciso, con emojis y saltos de línea listo para enviar por WhatsApp",
  "suggestedStatus": "Nuevo Lead" | "Cotización Pendiente" | "Cotizado" | "Esperando Pago" | "Cerrado",
  "extractedData": {
    "clientName": "Nombre detectado o null",
    "product": "Producto o null",
    "hscode": "Posicion NCM o null",
    "incoterm": "FOB" | "EXW" | "CIF" | "DDP",
    "goodsValue": "Valor FOB numerico o null",
    "weightKg": "Peso numerico o null",
    "cbm": "Volumen numerico o null",
    "shippingMode": "maritimo_compartido" | "maritimo_cbm" | "courier_aereo" | "all_in_aereo",
    "notes": "Resumen interno breve"
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

  // Modelos actualizados recomendados por la API
  const candidateModels = ["gemini-3.1-pro-preview", "gemini-2.5-flash"];
  let lastErrorDetail = "";

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

      lastErrorDetail = data.error?.message || JSON.stringify(data);
      console.warn(`Fallo con ${model}:`, lastErrorDetail);
    } catch (e) {
      lastErrorDetail = e.message;
      console.error(`Error con ${model}:`, e.message);
    }
  }

  return res.status(503).json({
    error: "Servicio de Sol temporalmente saturado.",
    details: lastErrorDetail
  });
}