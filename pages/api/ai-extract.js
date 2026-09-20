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
    const groqRes = await fetch('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API Error: ${errText}`);
    }

    const groqData = await groqRes.json();
    let rawContent = groqData.choices[0].message.content;

    // 1. Limpiar posibles markdown fences que agrega Groq por error
    rawContent = rawContent.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');

    // 2. Intentar parsear el JSON con defensas
    let content;
    try {
      content = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('JSON inválido de Groq. Raw:', rawContent);
      
      // Plan B: intentar reparar comillas triples de Python
      const repaired = rawContent.replace(/"""([\s\S]*?)"""/g, (m, p1) => JSON.stringify(p1));
      try {
        content = JSON.parse(repaired);
      } catch (e2) {
        // Plan C SALVAVIDAS: Si todo falla, no tiramos 500. Devolvemos un objeto válido 
        // para que Render no aborte y el mensaje se guarde en Supabase.
        console.error(`Groq devolvió JSON irrecuperable: ${rawContent.substring(0, 200)}`);
        content = {
          replyMessage: "Estoy procesando tu solicitud, dame un momento por favor. ⏳",
          suggestedStatus: "Revisar Manualmente",
          extractedData: {}
        };
      }
    }

    return res.status(200).json(content);
  } catch (error) {
    console.error('Error general en Sol AI:', error);
    return res.status(500).json({ error: error.message });
  }
}