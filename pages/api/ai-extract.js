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

RESPONDÉ ÚNICAMENTE UN OBJETO JSON VÁLIDO (sin bloques de código markdown, sin \`\`\`json) con esta estructura:
{
  "replyMessage": "Mensaje de WhatsApp para el cliente orientado al cierre",
  "suggestedStatus": "Nuevo Lead",
  "extractedData": {
    "clientName": "Nombre o null",
    "product": "Producto o null",
    "hscode": "Posicion NCM estimada o null",
    "incoterm": "FOB",
    "goodsValue": "4200",
    "weightKg": "380",
    "cbm": "2.4",
    "shippingMode": "maritimo_compartido",
    "notes": "Resumen breve para Franco o Ariel"
  }
}
`;

  // Lista de modelos ordenados por prioridad en caso de saturación
  const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        return res.status(200).json(JSON.parse(cleanedText));
      }

      // Si Google responde que el modelo está sobrecargado (high demand / 503), continúa al siguiente
      console.warn(`Modelo ${model} no disponible o con sobrecarga, intentando respaldo...`);
    } catch (e) {
      console.error(`Error consultando ${model}:`, e.message);
    }
  }

  return res.status(503).json({
    error: "Los servidores de IA están con alta demanda en este momento. Por favor probá en unos segundos."
  });
}