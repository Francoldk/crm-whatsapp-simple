import { SOL_SYSTEM_PROMPT } from '../../lib/sol-prompt';

export default async function handler(req, res) {
  // 1. CORS y OPTIONS (Recuperado de tu Handler B)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  // 2. Validación (Mantenido del Handler A)
  const { conversationHistory, imageBase64 } = req.body;
  if (!conversationHistory || !Array.isArray(conversationHistory)) {
    return res.status(400).json({ error: "Falta el historial de conversación" });
  }

  // 3. Formateo de mensajes + Soporte Visión (Recuperado de tu Handler B)
  const messages = [{ role: 'system', content: SOL_SYSTEM_PROMPT }];
  
  for (let i = 0; i < conversationHistory.length; i++) {
    const item = conversationHistory[i];
    const isLast = i === conversationHistory.length - 1;

    if (isLast && imageBase64 && (item.sender === "client" || item.sender === "user")) {
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
        role: (item.sender === "client" || item.sender === "user") ? "user" : "assistant",
        content: item.text || ""
      });
    }
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: messages,
        temperature: 0.7,
        top_p: 0.85,
        max_tokens: 1200,
        reasoning_effort: "none"
      })
    });

    const data = await groqRes.json();

    // 4. Salvavidas failed_generation (Recuperado de tu Handler B)
    if (!groqRes.ok && data?.error?.failed_generation) {
      return res.status(200).json({
        replyMessage: data.error.failed_generation.replace(/```json/g, "").replace(/```/g, "").trim(),
        suggestedStatus: "Cotizado",
        extractedData: {}
      });
    }

    if (!groqRes.ok) {
      console.error("Fallo de Groq:", data);
      return res.status(500).json({ error: "Fallo de Groq", details: data });
    }

    const raw = data.choices[0].message.content.trim();
    let parsed;
    
    // 5. Parseo ultra robusto (Recuperado de tu Handler B)
    try {
      const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (err) {
      parsed = {
        replyMessage: raw,
        suggestedStatus: "Revisar Manualmente",
        extractedData: {}
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error general en Sol AI:", error);
    return res.status(500).json({ error: error.message });
  }
}