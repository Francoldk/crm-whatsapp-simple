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
        model: 'llama-3.1-70b-versatile', // Modelo principal que veníamos usando
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
    const content = JSON.parse(groqData.choices[0].message.content);

    return res.status(200).json(content);
  } catch (error) {
    console.error('Error en Sol AI:', error);
    return res.status(500).json({ error: error.message });
  }
}