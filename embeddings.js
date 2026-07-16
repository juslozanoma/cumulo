import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChromaClient } from 'chromadb';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Función para dividir texto en chunks
function chunkText(text, maxLength = 1000) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  
  return chunks;
}

// Función para generar embedding
async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function main() {
  // Leer kb.json
  const kb = JSON.parse(fs.readFileSync('./public/kb.json', 'utf8'));
  
  // Convertir a texto plano
  const fullText = typeof kb === 'string' ? kb : JSON.stringify(kb, null, 2);
  
  // Dividir en chunks
  const chunks = chunkText(fullText, 800); // chunks de ~800 caracteres
  
  console.log(`Generando embeddings para ${chunks.length} chunks...`);
  
  // Conectar a Chroma
  const client = new ChromaClient();
  
  // Crear o obtener colección
  const collection = await client.getOrCreateCollection({
    name: "cumulo_kb",
    metadata: { description: "Base de conocimiento de Cúmulo" }
  });
  
  // Generar embeddings y guardar
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getEmbedding(chunks[i]);
    
    await collection.add({
      ids: [`chunk_${i}`],
      embeddings: [embedding],
      documents: [chunks[i]],
      metadatas: [{ index: i }]
    });
    
    console.log(`Chunk ${i + 1}/${chunks.length} procesado`);
  }
  
  console.log('✅ Embeddings generados y guardados en ChromaDB');
}

main().catch(console.error);