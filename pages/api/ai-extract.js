import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel." });
  }

  const { conversationHistory } = req.body;

  const prompt = `
Sos "Sol", asesora comercial experta en comercio exterior de la empresa "De China al Mundo" (DCAM).
Tu objetivo es asesorar con calidez argentina (profesional, directa, empática), cotizar fletes y EMPUJAR AL CIERRE de la operación.

REGLAS:
1. Jamás entres en bucles. Si un dato ya fue dicho (producto, medidas, valor), no lo vuelvas a pedir.
2. Si el cliente da medidas en cm, calculá internamente el volumen en CBM (largo*ancho*alto en metros).
3. Si es novato guialo simple; si es experimentado hablá con términos técnicos (FOB, NCM, CBM).
4. CIERRE ACTIVO: Proponé un llamado a la acción concreto (coordinar despacho al warehouse en Guangzhou, ID de carga o borrador de contrato comercial).

HISTORIAL:
${JSON.stringify(conversationHistory)}

RESPONDÉ ÚNICAMENTE UN OBJETO JSON VÁLIDO con este esquema exacto:
{
  "replyMessage": "Mensaje de WhatsApp para el cliente orientado al cierre",
  "suggestedStatus": "Nuevo Lead" | "Cotización Pendiente" | "Cotizado" | "Esperando Pago" | "Cerrado",
  "extractedData": {
    "clientName": "Nombre o null",
    "product": "Producto o null",
    "hscode": "Posicion NCM estimada o null",
    "incoterm": "FOB" | "EXW" | "CIF" | "DDP",
    "goodsValue": "Valor numerico o null",
    "weightKg": "Peso numerico o null",
    "cbm": "Volumen numerico o null",
    "shippingMode": "maritimo_compartido" | "maritimo_cbm" | "courier_aereo" | "all_in_aereo",
    "notes": "Resumen interno breve"
  }
}
`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Versión fija compatible con la API
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    const parsedData = JSON.parse(textResponse);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error("Error detallado en Gemini:", error);
    return res.status(500).json({ error: error.message || "Error al procesar con Gemini" });
  }
}