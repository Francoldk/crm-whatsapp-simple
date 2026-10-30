// ============================================================
// PROMPT DE SOL - Asesora Comercial y Closer de De China al Mundo
// ============================================================

export const SOL_SYSTEM_PROMPT = `Sos SOL, asesora comercial y closer de ventas de DE CHINA AL MUNDO. Atendés clientes por WhatsApp con trato humano, profesional, cálido, breve y 100% argentino. Tu misión es liderar la conversación hacia el cierre con seguridad y urgencia comercial. Asumí que el cliente quiere importar con nosotros.

PRIORIDAD DE REGLAS
1. Nunca inventar información o prometer condiciones no autorizadas.
2. Utilizar todos los datos confirmados en el historial (no volver a preguntar lo que ya se sabe).
3. Responder primero la consulta del cliente, de forma muy breve.
4. Hacé UNA SOLA PREGUNTA a la vez. Los clientes no leen textos largos.
5. Para cotizaciones, la secuencia obligatoria es: (1) Producto, (2) Peso o Volumen, (3) Valor FOB. Pedí solo el que falta.
6. ACTITUD CLOSER: Una vez entregada la cotización, no preguntes "¿qué te parece?". Usá llamados a la acción directos: "¿Avanzamos con esta opción para congelar la tarifa?", "¿Te derivo con un asesor para coordinar el embarque?" o "¿Qué modalidad elegís para que reservemos el lugar?".
7. Responder exclusivamente con JSON válido.

CONTEXTO DE CAPTACIÓN — PUBLICIDAD ACTUAL
- Muchos clientes llegan desde una publicidad que dice «IMPORTAMOS TU CARGA» y presenta precios DESDE: Courier USD 20/kg; LCL USD 400/m³; All Inclusive DESDE USD 2.000/m³.
- Estos precios son referenciales, NO finales. 
- ATENCIÓN: All Inclusive configurado en esta API es de USD 2.335 fijo (hasta 400kg o 2m³), sujeto a elegibilidad. NO lo multipliques por m³. Si hay diferencia con la publicidad, derivá a un asesor humano.

FLUJO DE VENTA PASO A PASO (WHATSAPP)
- Si el cliente ofrece peso, volumen y FOB juntos, aprovechalos y cotizá.
- Si falta algo, pedí solo UN dato por mensaje. Ejemplo: "Perfecto. ¿Sabés el peso total en kilos de esa mercadería?".
- Explicá FOB de forma simple si no lo conoce: "el precio que le pagás al proveedor".

MEMORIA COMERCIAL
- Analizá todo el historial. Si el cliente ya te dijo el producto, NO lo vuelvas a preguntar. 
- Si modifica un dato, usá el más reciente.
- No repitas una cotización a menos que cambien los datos o el cliente lo pida.

TARIFAS OFICIALES (No inventar otras)
AÉREO COURIER: Flete = kg × 20. Honorarios = 35. Seguro = FOB × 0.03. Impuestos est = FOB × 0.65.
MARÍTIMO IMPORTA EN GRUPO: Flete = kg × 5. Honorarios = 35. Seguro = FOB × 0.03. Impuestos est = FOB × 0.65.
MARÍTIMO LCL CARGA COMPARTIDA: Flete = m3 × 400. Honorarios = 35. Seguro = FOB × 0.03. Impuestos est = FOB × 0.65. (Requiere m3 y FOB).
ALL INCLUSIVE: Precio cerrado = USD 2335. (Hasta 400 kg o 2 m3). No sumar nada más.

FORMATO DE COTIZACIÓN (Breve y directo)
Acá tenés la estimación para [producto].
Peso: [peso] kg | Valor FOB: USD [valor].

✈️ AÉREO COURIER: USD [total] (Flete USD [importe], Hon USD 35, Seg USD [importe], Imp USD [importe])
🚢 IMPORTA EN GRUPO (Marítimo): USD [total] (Flete USD [importe], Hon USD 35, Seg USD [importe], Imp USD [importe])
No incluye valor de mercadería.

¿Con cuál de las dos avanzamos para reservar tu lugar? 🙌

RESPUESTA TÉCNICA OBLIGATORIA (Solo JSON)
{
  "intent": "consulta_puntual|cotizacion|saludo|otro",
  "suggestedStatus": "Entrante|Faltan Datos|Cotizado|Pre-Cierre|Cliente Cerrado",
  "extractedData": {
    "clientName": null,
    "product": null,
    "hscode": null,
    "weightKg": null,
    "cbm": null,
    "goodsValue": null,
    "shippingMode": null,
    "freightUSD": null,
    "insuranceUSD": null,
    "dutiesUSD": null,
    "taxesUSD": null,
    "totalLogisticsUSD": null
  },
  "replyMessage": "Texto corto y cerrador para el cliente"
}
`;

const SOL_COMPACT_PROMPT = `Sos SOL, asesora comercial y closer de DE CHINA AL MUNDO. Español argentino, cálida pero enfocada en cerrar. Mensajes cortos, ideales para WhatsApp. UNA pregunta por mensaje.
Regla vital: Si ya tenés un dato en el historial, NO lo vuelvas a preguntar. 
Para cotizar pedí en orden (solo el que falte): 1. Producto, 2. Peso kg O Volumen m3, 3. Valor FOB USD.
Tarifas: Courier=kg*20; MarítimoGrupo=kg*5; LCL=m3*400. Todos suman: honorarios 35, seguro FOB*0.03, imp FOB*0.65. All Inclusive=USD 2335 fijo.
Cierre: Nunca digas "¿qué te parece?". Usá "¿Avanzamos con esto?" o "¿Te derivo con un asesor para pagar?".
Solo JSON válido.`;

const num = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
const money = v => Number(v).toLocaleString('es-AR', {maximumFractionDigits: 2});
const allRx = /all\s*[- ]?inclusive|all\s*in\b/i;
const airRx = /\b(?:a[eé]re[oa]|courier)\b/i;
const seaRx = /\b(?:mar[ií]tim[oa]|lcl|importa en grupo)\b/i;
const getValue = v => Number(String(v).replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));

// Se simplificó para priorizar lo que ya extrajo el LLM antes (savedProduct) y evitar la amnesia
function productFromHistory(history, savedProduct) {
  if (savedProduct && savedProduct.trim() !== '') return savedProduct.trim();
  
  let product = null;
  for (const m of history) {
    if (m.sender === 'me') continue;
    const t = String(m.text || '').trim();
    const named = t.match(/(?:quiero|necesito|voy a|deseo|busco|importar|traer|cotizar)\s+(?:importar|traer|cotizar|unos?|unas?|el|la|los|las|de)?\s*([\p{L}][\p{L}\s-]{2,45})/iu);
    if (!product && named && !/^(?:saber|consultar|una cotizaci[oó]n|un presupuesto|precio|informaci[oó]n|cu[aá]nto)/i.test(named[1])) {
      product = named[1].replace(/[.!?].*$/, '').trim();
    }
  }
  return product;
}

// Se prioriza el estado guardado (saved) para que no borre variables confirmadas
function factsFromHistory(history, saved = {}) {
  const facts = {
    weightKg: num(saved.weightKg),
    goodsValue: num(saved.goodsValue),
    cbm: num(saved.cbm),
    product: productFromHistory(history, saved.product),
    shippingMode: saved.shippingMode || null
  };
  
  let pending = null;
  for (const m of history) {
    const t = String(m.text || '').trim();
    if (!t) continue;
    
    if (m.sender === 'me') {
      if (allRx.test(t) && /2[.,]?335|2335|cotizaci[oó]n|precio/i.test(t)) facts.shippingMode = 'all_inclusive';
      if (/valor\s*(?:fob|total)?|(?:cu[aá]nto|qu[eé])\s*(?:pag[aá]s?|vale|cuesta)|compra/i.test(t)) pending = 'goodsValue';
      else if (/metros?\s*c[uú]bicos?|\bm[³3]\b|\bcbm\b/i.test(t)) pending = 'cbm';
      else if (/peso|kilos?|\bkg\b/i.test(t)) pending = 'weightKg';
      continue;
    }
    
    if (allRx.test(t)) facts.shippingMode = 'all_inclusive';
    else if ((airRx.test(t) || seaRx.test(t)) && /(?:quiero|prefiero|eleg[ií]|cambiar|cotiz|opci[oó]n|solo|solamente)/i.test(t)) {
      facts.shippingMode = airRx.test(t) && !seaRx.test(t) ? 'aereo' : 'maritimo';
    }
    
    const wt = t.match(/(\d[\d.,]*)\s*(?:kg\b|kilos?\b|kilogramos?\b)/i);
    const fob = t.match(/(?:usd|u\$s|us\$|d[oó]lares?|fob)\s*[:$]?\s*(\d[\d.,]*)/i) || t.match(/\$\s*(\d[\d.,]*)/);
    const volume = t.match(/(\d[\d.,]*)\s*(?:m[³3](?!\w)|cbm\b|metros?\s*c[uú]bicos?)/i);
    
    if (wt && num(getValue(wt[1]))) facts.weightKg = getValue(wt[1]);
    if (fob && num(getValue(fob[1]))) facts.goodsValue = getValue(fob[1]);
    if (volume && num(getValue(volume[1]))) facts.cbm = getValue(volume[1]);
    
    if (/^\s*\d[\d.,]*\s*$/.test(t)) {
      const value = num(getValue(t));
      if (value && pending === 'goodsValue') facts.goodsValue = value;
      else if (value && pending === 'weightKg') facts.weightKg = value;
      else if (value && pending === 'cbm') facts.cbm = value;
    }
    pending = null;
  }
  return facts;
}

function allInclusiveResponse(history, facts) {
  if (facts.shippingMode !== 'all_inclusive') return null;
  const clients = history.filter(m => m.sender !== 'me');
  const last = String(clients.at(-1)?.text || '').trim();
  if (!last || !facts.product) return null;
  
  const explicitlyAskingPrice = /(?:cotiz|presupuest|precio|cu[aá]nto\s*(?:sale|cuesta))/i.test(last);
  const mentionsAll = allRx.test(last);
  const hasData = /\d\s*(?:kg|kilos?|usd|d[oó]lares?|m[³3]|cbm)\b|^\s*\d[\d.,]*\s*$/i.test(last);
  
  if (!mentionsAll && !explicitlyAskingPrice && !hasData) return null;
  const eligibleSize = (facts.weightKg != null && facts.weightKg <= 400) || (facts.cbm != null && facts.cbm <= 2);
  
  let reply;
  if (facts.weightKg == null && facts.cbm == null) {
    reply = `Para verificar si ${facts.product} aplica al All Inclusive (USD 2.335 fijo), ¿cuál es el peso total en kilos o volumen en m3?`;
  } else if (facts.goodsValue == null) {
    reply = `Bárbaro, tengo los ${facts.weightKg != null ? facts.weightKg + ' kg' : facts.cbm + ' m³'}. ¿Cuál es el valor FOB total en dólares para completar el registro de la operación?`;
  } else if (facts.weightKg > 400 && !(facts.cbm != null && facts.cbm <= 2)) {
    reply = 'Por el peso, necesitamos validar el volumen para ver si aplica a la tarifa de USD 2.335. ¿Cuántos m³ ocupa?';
  } else {
    reply = `📦 COTIZACIÓN ALL INCLUSIVE\n💰 Precio cerrado: USD 2.335\n✅ Incluye flete, aduana y honorarios hasta Sarandí.\nSujeto a confirmación final de la mercadería.\n\n¿Avanzamos con esta opción para coordinar con un asesor? 🙌`;
  }
  
  return {
    intent: 'cotizacion', 
    suggestedStatus: eligibleSize && facts.product && facts.goodsValue != null ? 'Pre-Cierre' : 'Faltan Datos', 
    extractedData: { clientName: null, product: facts.product, hscode: null, weightKg: facts.weightKg, cbm: facts.cbm, goodsValue: facts.goodsValue, shippingMode: 'all_inclusive', freightUSD: null, insuranceUSD: null, dutiesUSD: null, taxesUSD: null, totalLogisticsUSD: eligibleSize && facts.product && facts.goodsValue != null ? 2335 : null },
    replyMessage: reply
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { conversationHistory, quoteData = {} } = req.body;
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: 'Historial inválido' });
    }

    const facts = factsFromHistory(conversationHistory, quoteData);
    
    // Se eliminó 'deterministicAnswer' para que el LLM procese la conversación y fluya naturalmente.
    
    const guard = allInclusiveResponse(conversationHistory, facts);
    if (guard) return res.status(200).json(guard);

    const lastClientMessage = [...conversationHistory].reverse().find(m => m.sender !== 'me');
    const previousQuotes = conversationHistory.filter(m => m.sender === 'me' && /cotizaci[oó]n|total estimado|precio de referencia|presupuesto/i.test(String(m.text || '')));
    const currentStage = !facts.product ? 'IDENTIFICAR PRODUCTO' :
      (facts.weightKg == null && facts.cbm == null) ? 'PEDIR PESO O VOLUMEN' :
      facts.goodsValue == null ? 'PEDIR FOB' : 'CERRAR VENTA';
      
    const shortHistory = conversationHistory.slice(-10).map(msg => ({
      role: msg.sender === 'me' ? 'assistant' : 'user',
      content: String(msg.text || '').slice(0, 900)
    }));
    
    const messages = [
      { role: 'system', content: SOL_COMPACT_PROMPT },
      { role: 'system', content: `ESTADO: ${JSON.stringify({
        product: facts.product, weightKg: facts.weightKg, cbm: facts.cbm,
        goodsValue: facts.goodsValue, shippingMode: facts.shippingMode
      })}. Etapa: ${currentStage}. ¿Ya se cotizó?: ${previousQuotes.length > 0}. Último msj: ${JSON.stringify(lastClientMessage?.text || '')}. Hacé UNA SOLA PREGUNTA. Sé cerradora.` },
      ...shortHistory
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
     body: JSON.stringify({
        model: "qwen-2.5-32b",
        messages: messages,
        temperature: 0.3, 
        max_tokens: 850,
        response_format: { type: "json_object" } 
      })
    });

    if (!response.ok) {
      const rawGroqError = await response.text().catch(() => '');
      let groqDetail = rawGroqError;
      try {
        const parsedError = JSON.parse(rawGroqError);
        groqDetail = parsedError?.error?.message || parsedError?.message || rawGroqError;
      } catch (_) {}
      console.error(`[SOL GROQ] HTTP ${response.status}: ${String(groqDetail).slice(0, 1200)}`);
      if (response.status === 429) {
        const wait = Math.max(10, Math.min(120, Math.ceil(Number(response.headers.get('retry-after')) || 30)));
        res.setHeader('Retry-After', String(wait));
        return res.status(429).json({ error: 'Límite de Groq', retryAfter: wait });
      }
      return res.status(response.status >= 500 ? 502 : 500).json({
        error: `Groq rechazó la solicitud (HTTP ${response.status}). Revisá los logs de Vercel.`,
      });
    }

    const data = await response.json();
    const rawReply = data?.choices?.[0]?.message?.content;
    if (!rawReply || typeof rawReply !== 'string') {
      console.error('[SOL GROQ] Respuesta sin contenido:', JSON.stringify(data?.choices?.[0] || {}).slice(0, 600));
      throw new Error('Groq devolvió una respuesta vacía');
    }
    let parsedData;
    try {
      parsedData = JSON.parse(rawReply.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (parseError) {
      console.error('[SOL GROQ] JSON inválido:', rawReply.slice(0, 500));
      throw new Error('Groq devolvió un JSON inválido');
    }
    if (!parsedData || typeof parsedData !== 'object' || typeof parsedData.replyMessage !== 'string' || !parsedData.replyMessage.trim()) {
      console.error('[SOL GROQ] Falta replyMessage:', rawReply.slice(0, 500));
      throw new Error('La respuesta de Sol no contiene replyMessage');
    }

    parsedData.extractedData = { ...(parsedData.extractedData || {}) };
    for (const key of ['product', 'weightKg', 'goodsValue', 'cbm']) {
      if (facts[key] != null) parsedData.extractedData[key] = facts[key];
    }
    
    if (facts.shippingMode === 'all_inclusive') {
      parsedData.extractedData.shippingMode = 'all_inclusive';
      if (/OPCI[OÓ]N\s*A[EÉ]REA|OPCI[OÓ]N\s*MAR[IÍ]TIMA/i.test(String(parsedData.replyMessage || ''))) {
        parsedData.replyMessage = `Seguimos con All Inclusive (referencia USD 2.335). ${facts.product ? '¿Avanzamos con un asesor para validar la carga?' : '¿Qué producto querés importar?'}`;
      }
    }

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Error crítico en ai-extract:", error);
    return res.status(500).json({ error: error.message });
  }
}
