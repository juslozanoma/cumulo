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

  const { query, context, mode } = req.body;

  // Modo Live: el contexto ya viene enriquecido desde el frontend
  // Modo Chat: el contexto también viene del frontend (findRelevantChunks)
  const prompt = `Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomia Cumulo.

DOCUMENTOS RELEVANTES:
${context || 'No se encontraron documentos relevantes.'}

PREGUNTA DEL USUARIO: ${query}

INSTRUCCIONES:
1. Responde UNICAMENTE basandote en los documentos proporcionados
2. Si la informacion no esta en los documentos, di claramente "No encontre informacion sobre esto en los documentos"
3. Se preciso sobre fechas, decisiones y personas mencionadas
4. Si hay decisiones anuladas o actualizadas, menciona ambas versiones
5. Estructura tu respuesta de forma clara y facil de leer
6. ${mode === 'live' ? 'Responde de forma extremadamente breve y concisa (máximo 30 palabras), como en una conversación de voz.' : 'Responde con un analisis breve (menos de 50 palabras).'}`;

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
