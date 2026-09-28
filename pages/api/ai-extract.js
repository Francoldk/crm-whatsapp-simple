import { SOL_SYSTEM_PROMPT } from '../../lib/sol-prompt';

export default async function handler(req, res) {
  // 1. CORS y OPTIONS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  // 2. Validación de input
  const { conversationHistory, imageBase64 } = req.body;
  if (!conversationHistory || !Array.isArray(conversationHistory)) {
    return res.status(400).json({ error: "Falta el historial de conversación" });
  }

  // 3. Formateo de mensajes + Soporte Visión
  const messages = [{ role: "system", content: SOL_SYSTEM_PROMPT }];

  for (let i = 0; i < conversationHistory.length; i++) {
    const item = conversationHistory[i];
    const isLast = i === conversationHistory.length - 1;
    const isClient = item.sender === "client" || item.sender === "user";

    if (isLast && imageBase64 && isClient) {
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
        role: isClient ? "user" : "assistant",
        content: item.text || ""
      });
    }
  }

  // 4. Llamada a Groq con timeout de 25s
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: messages,
        temperature: 0.7,
        top_p: 0.85,
        max_tokens: 1200
      })
    });

    clearTimeout(timeoutId);

    const data = await groqRes.json();

    // 5. Salvavidas: el modelo rompió el JSON pero Groq devolvió texto usable
    if (!groqRes.ok && data?.error?.failed_generation) {
      const salvaged = data.error.failed_generation
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return res.status(200).json({
        intent: "cotizacion",
        suggestedStatus: "Cotizado",
        extractedData: {},
        replyMessage: salvaged
      });
    }

    // 6. Error real de Groq (modelo caído, cuota, etc.)
    if (!groqRes.ok) {
      console.error("Fallo de Groq:", data);
      return res.status(500).json({ error: "Fallo de Groq", details: data });
    }

    // 7. Validación de que la respuesta tenga contenido
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.error("Respuesta vacía de Groq:", data);
      return res.status(502).json({ error: "Respuesta vacía del modelo", details: data });
    }

    // 8. Parseo ultra robusto: captura el primer objeto JSON válido
    let parsed;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No se encontró JSON en la respuesta");
      parsed = JSON.parse(match[0]);
    } catch (err) {
      // Fallback: devolvemos el texto crudo como mensaje
      parsed = {
        intent: "otro",
        suggestedStatus: "Faltan Datos",
        extractedData: {},
        replyMessage: raw
      };
    }

    // 9. Garantizar que siempre existan las claves esperadas
    return res.status(200).json({
      intent: parsed.intent ?? "otro",
      suggestedStatus: parsed.suggestedStatus ?? "Faltan Datos",
      extractedData: parsed.extractedData ?? {},
      replyMessage: parsed.replyMessage ?? raw
    });

  } catch (error) {
    // 10. Timeout o error de red
    if (error.name === "AbortError") {
      console.error("Timeout de Groq (>25s)");
      return res.status(504).json({ error: "Timeout del modelo" });
    }
    console.error("Error general en Sol AI:", error);
    return res.status(500).json({ error: error.message });
  }
}