import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN
// ============================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const EVOLUTION_URL = 'https://evolution-api-5q3w.onrender.com';
const EVOLUTION_API_KEY = 'cumulo2308';
const INSTANCE_NAME = 'whatsapp-cumulo';

// ============================================
// FUNCIONES PARA SIMILITUD DE COSENO
// ============================================

// Calcular similitud de coseno entre dos vectores
// Esto mide qué tan "cerca" están dos embeddings en el espacio numérico
// Valor 1 = idénticos, 0 = completamente diferentes
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================
// DIVIDIR TEXTO EN CHUNKS
// ============================================

// Toma el texto largo y lo corta en pedazos más pequeños
// Cada chunk tiene máximo 2000 caracteres para no ser muy grande
function chunkText(text, maxLength = 2000) {
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

// ============================================
// GENERAR EMBEDDING CON GEMINI
// ============================================

// Convierte un texto en un vector numérico (lista de ~768 números)
// Este vector captura el "significado" del texto
async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ============================================
// CARGAR O CREAR EMBEDDINGS
// ============================================

let chunks = [];        // Los textos originales divididos
let embeddings = [];    // Los vectores numéricos de cada texto

async function initKnowledgeBase() {
  console.log('📚 Inicializando base de conocimiento...');
  
  // Si ya existe embeddings.json, lo cargamos (más rápido)
  if (fs.existsSync('./embeddings.json')) {
    console.log('✅ Cargando embeddings existentes...');
    const data = JSON.parse(fs.readFileSync('./embeddings.json', 'utf8'));
    chunks = data.chunks;
    embeddings = data.embeddings;
    console.log(`✅ ${chunks.length} chunks cargados desde archivo`);
    return;
  }
  
  // Si no existe, generamos todo desde cero
  console.log('🔄 Generando embeddings por primera vez...');
  console.log('⏳ Esto puede tardar varios minutos dependiendo del tamaño de kb.json...');
  
  // Leer kb.json
  const kb = JSON.parse(fs.readFileSync('./public/kb.json', 'utf8'));
  const fullText = typeof kb === 'string' ? kb : JSON.stringify(kb, null, 2);
  
  // Dividir en chunks de ~2000 caracteres
  chunks = chunkText(fullText, 2000);
  console.log(`📄 ${chunks.length} chunks generados de kb.json`);
  
  // Generar embedding para cada chunk usando Gemini
  // Con pausas para no exceder la cuota gratuita
  embeddings = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await getEmbedding(chunks[i]);
      embeddings.push(embedding);
      console.log(`✅ Chunk ${i + 1}/${chunks.length} procesado`);
      
      // Esperar 4 segundos entre cada chunk (15 por minuto = 1 cada 4 seg)
      if (i < chunks.length - 1) {
        console.log(`⏳ Esperando 4 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch (error) {
      if (error.message.includes('429')) {
        console.log(`⏳ Cuota excedida. Esperando 60 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        i--; // Reintentar este chunk
      } else {
        throw error;
      }
    }
  }
    
  // Guardar en archivo para no repetir en el futuro
  fs.writeFileSync('./embeddings.json', JSON.stringify({ chunks, embeddings }));
  console.log('🎉 Embeddings guardados en embeddings.json');
  console.log('💡 La próxima vez se cargarán automáticamente desde el archivo');
}

// ============================================
// BUSCAR CHUNKS RELEVANTES
// ============================================

// Cuando llega una pregunta:
// 1. Convertimos la pregunta a embedding
// 2. Comparamos con todos los embeddings guardados
// 3. Devolvemos los 3 textos más similares
async function searchRelevantChunks(query, nResults = 3) {
  const queryEmbedding = await getEmbedding(query);
  
  // Calcular similitud con cada chunk guardado
  const similarities = embeddings.map((emb, i) => ({
    index: i,
    similarity: cosineSimilarity(queryEmbedding, emb)
  }));
  
  // Ordenar de mayor a menor similitud
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Tomar los top N
  const topResults = similarities.slice(0, nResults);
  
  console.log(`🔍 Similitudes: ${topResults.map(r => r.similarity.toFixed(3)).join(', ')}`);
  
  return topResults.map(r => chunks[r.index]);
}

// ============================================
// API PARA EL FRONTEND REACT
// ============================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Buscar solo los chunks relevantes (no todo kb.json)
    const relevantChunks = await searchRelevantChunks(message, 3);
    const context = relevantChunks.join('\n\n');
    
    console.log(`\n💬 Pregunta: ${message}`);
    console.log(`📄 Contexto usado: ${context.length} caracteres (de ${JSON.stringify(fs.readFileSync('./public/kb.json', 'utf8')).length} totales)`);
    
    // Enviar a Gemini solo el contexto relevante + la pregunta
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const prompt = `Usa SOLO esta información para responder. Si no sabes, di "No tengo esa información en mi base de conocimiento":

${context}

Pregunta: ${message}`;

    const result = await model.generateContent(prompt);
    const respuesta = result.response.text();

    res.json({ reply: respuesta });
  } catch (error) {
    console.error('❌ Error en /api/chat:', error);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

// ============================================
// WEBHOOK DE WHATSAPP
// ============================================

app.post('/webhook', async (req, res) => {
  try {
    const mensaje = req.body.data?.message?.conversation;
    const numero = req.body.data?.key?.remoteJid;

    // Ignorar mensajes enviados por mí mismo (evita bucles infinitos)
    if (req.body.data?.key?.fromMe) return res.sendStatus(200);
    if (!mensaje) return res.sendStatus(200);

    console.log(`\n📩 WhatsApp de ${numero}: ${mensaje}`);

    // Buscar chunks relevantes
    const relevantChunks = await searchRelevantChunks(mensaje, 3);
    const context = relevantChunks.join('\n\n');

    // Consultar Gemini con solo el contexto relevante
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const prompt = `Usa SOLO esta información para responder. Si no sabes, di "No tengo esa información":

${context}

Pregunta: ${mensaje}`;

    const result = await model.generateContent(prompt);
    const respuesta = result.response.text();

    console.log(`🤖 Respuesta: ${respuesta}`);

    // Enviar respuesta de vuelta por WhatsApp
    await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: numero.replace('@s.whatsapp.net', ''),
        text: respuesta
      })
    });

    console.log(`✅ Enviado a ${numero}`);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error webhook:', error);
    res.sendStatus(500);
  }
});

// ============================================
// SERVIR REACT EN PRODUCCIÓN
// ============================================

// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static('dist'));
  
//   app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
//   });
// }

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 10000;

// ESCUCHAR PUERTO INMEDIATAMENTE (Render necesita esto)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cúmulo corriendo en puerto ${PORT}`);
  console.log(`📱 WhatsApp webhook: POST /webhook`);
  console.log(`💬 Chat API: POST /api/chat`);
});

// Cargar embeddings en segundo plano (no bloquea el servidor)
initKnowledgeBase().then(() => {
  console.log('✅ Base de conocimiento lista');
}).catch(err => {
  console.error('❌ Error al cargar embeddings:', err);
});