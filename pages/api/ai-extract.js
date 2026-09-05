export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel." });
  }

  const { conversationHistory, imageBase64, imageMimeType } = req.body;

  const systemInstruction = `
Sos "Sol", asesora comercial experta en comercio exterior de la empresa "De China al Mundo" (DCAM).
Tu objetivo es asesorar con calidez argentina (profesional, directa, empática), cotizar servicios logísticos y EMPUJAR AL CIERRE de la operación.

REGLAS DE ATENCIÓN Y COTIZACIÓN:
1. LECTURA MULTIMODAL: Si se envía una imagen, remito, captura de Alibaba o proforma, analizala detenidamente. Extraé producto, cantidades, dimensiones (L x W x H), peso total (Kg) y valor de la mercadería (USD FOB). Calculá el volumen en CBM (m3) automáticamente.
2. ENFOQUE EN EL COSTO DEL FLETE (MUY IMPORTANTE):
   - Al cliente le interesa saber cuánto le sale traer la carga.
   - NUNCA sumes el valor FOB de la mercadería al costo del flete. El cliente ya sabe cuánto le pagó a su fábrica; si ve un total gigante se asusta y se cae la venta.
   - Mostrá el Costo Logístico / Flete como el valor principal y claro.
   - Si la carga cuenta con datos suficientes, mostrá 2 opciones claras cuando aplique (Marítimo LCL vs Courier Aéreo / All In) indicando tiempos estimados y recomendando la más conveniente económicamente.
   - Presentá la estimación tributaria/aduanera (DDI, Tasa Estadística, IVA, Ganancias, IIBB) en un bloque secundario y diferenciado, aclarando que son tributos oficiales de nacionalización.
3. CIERRE ACTIVO (SIN PREGUNTAS PASIVAS):
   - Prohibido terminar con "¿Te sirve?", "¿Alguna duda?" o "Quedo a la espera".
   - Cerrá siempre guiando al próximo paso de la operación: coordinar el envío a nuestro warehouse en Guangzhou/Ningbo, asignarle su ID de carga para el rotulado, o preparar el borrador del contrato comercial.

HISTORIAL DE MENSAJES:
${JSON.stringify(conversationHistory || [])}

RESPONDÉ ESTRICTAMENTE UN OBJETO JSON VÁLIDO (sin bloques markdown \`\`\`json) con el siguiente esquema:
{
  "replyMessage": "Texto de la respuesta para el cliente por WhatsApp, con tono vendedor, flete claro como protagonista y llamado a la acción al cierre",
  "suggestedStatus": "Nuevo Lead" | "Cotización Pendiente" | "Cotizado" | "Esperando Pago" | "Cerrado",
  "extractedData": {
    "clientName": "Nombre del cliente o empresa si se detecta, o null",
    "product": "Producto identificado o null",
    "hscode": "Posición arancelaria estimada o null",
    "incoterm": "FOB" | "EXW" | "CIF" | "DDP",
    "goodsValue": "Valor FOB numérico o null",
    "weightKg": "Peso total en Kg numérico o null",
    "cbm": "Volumen en m3 numérico o null",
    "shippingMode": "maritimo_compartido" | "maritimo_cbm" | "courier_aereo" | "all_in_aereo",
    "notes": "Resumen interno breve para Franco o Ariel (ej: Flete marítimo conveniente, mercadería lista en fábrica)"
  }
}
`;

  // Construcción del contenido multimodal o solo texto
  const parts = [{ text: systemInstruction }];

  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: imageMimeType || "image/jpeg",
        data: imageBase64.replace(/^data:image\/\w+;base64,/, "")
      }
    });
  }

  // Modelos ordenados con respaldo automático
  const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
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

      console.warn(`Modelo ${model} no disponible o con sobrecarga, pasando al siguiente...`);
    } catch (e) {
      console.error(`Error consultando ${model}:`, e.message);
    }
  }

  return res.status(503).json({
    error: "Los servidores de IA están con alta demanda en este momento. Probá nuevamente en unos segundos."
  });
}