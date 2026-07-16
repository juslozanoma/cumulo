import { useEffect, useState } from 'react';

export function useKnowledgeBase() {
  const [kbDocuments, setKbDocuments] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);

  useEffect(() => {
    async function loadKB() {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'kb.json');
        const docs = await res.json();
        setKbDocuments(docs);
        const flat = docs.flatMap((doc) => doc.chunks.map((chunk) => ({ ...chunk, _doc: doc })));
        setKnowledgeBase(flat);
        console.log('Cargados ' + docs.length + ' documentos, ' + flat.length + ' chunks');
      } catch (e) {
        console.error('Error cargando KB:', e);
      }
    }
    loadKB();
  }, []);

  return { kbDocuments, knowledgeBase };
}