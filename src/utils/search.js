export function findRelevantChunks(knowledgeBase, query) {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return [];

  return knowledgeBase
    .map((chunk) => {
      let score = 0;
      const text = (chunk.text || '').toLowerCase();
      const doc = chunk._doc;
      const filename = (doc.file?.name || '').toLowerCase();
      const section = (chunk.section || '').toLowerCase();
      const docType = (doc.document_type || '').toLowerCase();
      const committee = (doc.committee || '').toLowerCase();

      queryWords.forEach((word) => {
        const matches = (text.match(new RegExp(word, 'g')) || []).length;
        score += matches;
        if (filename.includes(word)) score += 5;
        if (section.includes(word)) score += 3;
        if (docType.includes(word)) score += 4;
        if (committee.includes(word)) score += 4;
        if ((doc.keywords || []).some((kw) => kw.toLowerCase().includes(word))) score += 2;
      });

      const dateStr = doc.dates?.start;
      if (dateStr) {
        const dateVal = new Date(dateStr).getTime();
        if (!isNaN(dateVal)) {
          const now = Date.now();
          const daysDiff = (now - dateVal) / (1000 * 60 * 60 * 24);
          if (daysDiff < 365) score += 3;
          if (daysDiff < 90) score += 5;
          if (daysDiff < 30) score += 8;
        }
      }

      return { chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.chunk);
}

export function buildContext(chunks) {
  if (!chunks || chunks.length === 0) return 'No se encontraron documentos relevantes.';
  return chunks
    .map((chunk) => {
      const doc = chunk._doc;
      const parts = [];
      parts.push('📄 ' + doc.document_id + ' | ' + doc.document_type.toUpperCase() + ' | ' + doc.committee);
      parts.push('📅 Fecha: ' + (doc.dates?.start || 'sin fecha') + ' | Estado: ' + doc.status);
      if (doc.participants?.length > 0) {
        parts.push('👥 Participantes: ' + doc.participants.map((p) => p.name + ' (' + p.role + ')').join(', '));
      }
      parts.push('📝 Seccion: ' + (chunk.section || 'contenido general'));
      parts.push('');
      parts.push(chunk.text);
      return parts.join('\n');
    })
    .join('\n\n---DOCUMENTO SIGUIENTE---\n\n');
}

export function getRecentHistory(qaHistory, maxTurns) {
  return qaHistory.slice(-maxTurns).filter((h) => h.question && h.answer);
}

export function buildHistoryBlock(qaHistory, maxTurns) {
  const recent = getRecentHistory(qaHistory, maxTurns || 3);
  if (recent.length === 0) return '';
  const lines = recent.map((h) => 'Usuario: ' + h.question + '\nAsistente: ' + h.answer).join('\n\n');
  return (
    '\n\nHISTORIAL RECIENTE DE LA CONVERSACION (usalo unicamente para entender referencias como "eso", "cuando se creo", "quien lo propuso", etc. No repitas esta informacion, solo interpretala):\n' +
    lines +
    '\n'
  );
}

// Amplia la busqueda de chunks con la ultima pregunta, para que las
// preguntas de seguimiento sin palabras clave propias sigan recuperando
// los documentos correctos.
export function buildRetrievalQuery(qaHistory, query) {
  const recent = getRecentHistory(qaHistory, 1);
  if (recent.length === 0) return query;
  return (recent[0].question + ' ' + query).trim();
}