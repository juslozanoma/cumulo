export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { query, context, mode, history, documentMode } = req.body;

  // 'history' (opcional): arreglo de turnos previos [{ question, answer }, ...]
  // Se usa para que preguntas de seguimiento ("cuando se creo?") se entiendan
  // en el contexto de lo preguntado antes, sin repetirlo en la respuesta.
  const historyBlock = Array.isArray(history) && history.length > 0
    ? `\n\nHISTORIAL RECIENTE DE LA CONVERSACION (usalo solo para entender referencias como "eso", "cuando se creo", "quien lo propuso", etc.):\n` +
      history.slice(-3).map(h => `Usuario: ${h.question}\nAsistente: ${h.answer}`).join('\n\n') + '\n'
    : '';

  // Modo Live: el contexto ya viene enriquecido desde el frontend
  // Modo Chat: el contexto también viene del frontend (findRelevantChunks)
  const prompt = documentMode
    ? `Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomia Cumulo. Con base en los documentos proporcionados, redacta el documento que pide el usuario (carta, certificado, constancia, etc.) de forma completa, formal y bien estructurada (encabezado, cuerpo, cierre y firma si corresponde). Usa fechas, nombres, cargos y decisiones reales de los documentos cuando sean relevantes; si falta un dato especifico, deja un marcador claro como "[completar]" en vez de inventarlo.

DOCUMENTOS RELEVANTES:
${context || 'No se encontraron documentos relevantes.'}${historyBlock}

SOLICITUD DEL USUARIO: ${query}

Entrega unicamente el texto completo del documento, listo para usar.`
    : `Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomia Cumulo.

DOCUMENTOS RELEVANTES:
${context || 'No se encontraron documentos relevantes.'}${historyBlock}

PREGUNTA DEL USUARIO: ${query}

INSTRUCCIONES:
1. Basa tu respuesta en la informacion de los documentos proporcionados
2. Si la pregunta hace referencia a algo mencionado antes en la conversacion, usa el HISTORIAL para saber a que se refiere
3. Si la pregunta pide un analisis, opinion o inferencia que no esta escrita explicitamente (ej. que podria faltar, riesgos, recomendaciones), razona brevemente a partir de la informacion disponible y aclara que es un analisis
4. Si la pregunta busca un dato factual puntual que simplemente no aparece en los documentos ni se puede inferir, di claramente "No encontre informacion sobre esto en los documentos"
5. Se preciso sobre fechas, decisiones y personas mencionadas
6. Si hay decisiones anuladas o actualizadas, menciona ambas versiones
7. Estructura tu respuesta de forma clara y facil de leer
8. ${mode === 'live' ? 'Responde de forma extremadamente breve y concisa (máximo 30 palabras), como en una conversación de voz.' : 'Responde con un analisis breve (menos de 50 palabras).'}`;

  try {
    const model = mode === 'live' ? 'gemini-3.1-flash-live-preview' : 'gemini-3.1-flash-lite';
    
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' +
      process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
