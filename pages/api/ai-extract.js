import { SOL_SYSTEM_PROMPT } from '../../lib/sol-prompt';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { conversationHistory } = req.body;
  if (!conversationHistory || !Array.isArray(conversationHistory)) {
    return res.status(400).json({ error: 'Falta el historial de conversación' });
  }

  // Formateamos los mensajes para Groq
  const messages = [
    { role: 'system', content: SOL_SYSTEM_PROMPT },
    ...conversationHistory.map(m => ({
      role: m.sender === 'me' ? 'assistant' : 'user',
      content: m.text || ''
    }))
  ];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b", // Tu modelo original y seguro
        messages: messages,
        temperature: 0.7,        // Tus parámetros de calidez
        top_p: 0.85,             
        max_tokens: 1200,        
        reasoning_effort: "none" 
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error("Fallo de Groq:", data);
      return res.status(500).json({ error: "Fallo de Groq", details: data });
    }

    const raw = data.choices[0].message.content.trim();
    let parsed;
    
    // Parseo simple con red de seguridad
    try {
      const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (err) {
      // Si por algún motivo escupe texto en vez de JSON, lo atajamos acá sin tirar 500
      parsed = {
        replyMessage: raw,
        suggestedStatus: "Revisar Manualmente",
        extractedData: {}
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Error general en Sol AI:', error);
    return res.status(500).json({ error: error.message });
  }
}