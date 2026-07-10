export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, context } = req.body;

  const prompt = `Eres un asistente experto en los procesos, decisiones y documentos del grupo de astronomía Cúmulo.

DOCUMENTOS RELEVANTES:
${context}

PREGUNTA DEL USUARIO: ${query}

INSTRUCCIONES:
1. Responde ÚNICAMENTE basándote en los documentos proporcionados
2. Si la información no está en los documentos, di claramente "No encontré información sobre esto en los documentos"
3. Sé preciso sobre fechas, decisiones y personas mencionadas
4. Si hay decisiones anuladas o actualizadas, menciona ambas versiones
5. Estructura tu respuesta de forma clara y fácil de leer`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + 
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
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}