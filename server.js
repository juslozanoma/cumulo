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
// CONFIGURACION
// ============================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const EVOLUTION_URL = 'https://evolution-api-5q3w.onrender.com';
const EVOLUTION_API_KEY = 'cumulo2308';
const INSTANCE_NAME = 'whatsapp-cumulo2';

// Memoria de conversaciones
const conversationMemory = new Map();
const MAX_MEMORY = 10;

function getConversationHistory(number) {
  const cleanNum = cleanNumber(number);
  return conversationMemory.get(cleanNum) || [];
}

function addToHistory(number, role, text) {
  const cleanNum = cleanNumber(number);
  let history = conversationMemory.get(cleanNum) || [];
  
  // Truncar texto largo (máx 200 caracteres por mensaje)
  const truncated = text.length > 200 ? text.substring(0, 200) + '...' : text;
  
  history.push({ role, text: truncated, timestamp: Date.now() });
  
  if (history.length > MAX_MEMORY) {
    history = history.slice(-MAX_MEMORY);
  }
  
  conversationMemory.set(cleanNum, history);
}

// ============================================
// FUNCIONES PARA SIMILITUD DE COSENO
// ============================================

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

async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ============================================
// CARGAR O CREAR EMBEDDINGS
// ============================================

let chunks = [];
let embeddings = [];

async function initKnowledgeBase() {
  console.log('📚 Inicializando base de conocimiento...');

  if (fs.existsSync('./embeddings.json')) {
    console.log('✅ Cargando embeddings existentes...');
    const data = JSON.parse(fs.readFileSync('./embeddings.json', 'utf8'));
    chunks = data.chunks;
    embeddings = data.embeddings;
    console.log(`✅ ${chunks.length} chunks cargados desde archivo`);
    return;
  }

  console.log('🔄 Generando embeddings por primera vez...');
  console.log('⏳ Esto puede tardar varios minutos dependiendo del tamano de kb.json...');

  const kb = JSON.parse(fs.readFileSync('./public/kb.json', 'utf8'));
  const fullText = typeof kb === 'string' ? kb : JSON.stringify(kb, null, 2);

  chunks = chunkText(fullText, 2000);
  console.log(`📄 ${chunks.length} chunks generados de kb.json`);

  embeddings = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await getEmbedding(chunks[i]);
      embeddings.push(embedding);
      console.log(`✅ Chunk ${i + 1}/${chunks.length} procesado`);

      if (i < chunks.length - 1) {
        console.log(`⏳ Esperando 4 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch (error) {
      if (error.message.includes('429')) {
        console.log(`⏳ Cuota excedida. Esperando 60 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        i--;
      } else {
        throw error;
      }
    }
  }

  fs.writeFileSync('./embeddings.json', JSON.stringify({ chunks, embeddings }));
  console.log('🎉 Embeddings guardados en embeddings.json');
  console.log('💡 La proxima vez se cargaran automaticamente desde el archivo');
}

// ============================================
// BUSCAR CHUNKS RELEVANTES
// ============================================

async function searchRelevantChunks(query, nResults = 3) {
  const queryEmbedding = await getEmbedding(query);

  const similarities = embeddings.map((emb, i) => ({
    index: i,
    similarity: cosineSimilarity(queryEmbedding, emb)
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  const topResults = similarities.slice(0, nResults);

  console.log(`🔍 Similitudes: ${topResults.map(r => r.similarity.toFixed(3)).join(', ')}`);

  return topResults.map(r => chunks[r.index]);
}

// ============================================
// ═══════════════════════════════════════════
// NUEVAS FUNCIONES: "ESCRIBIENDO..."
// ═══════════════════════════════════════════
// ============================================


/**
 * Limpia el numero de WhatsApp quitando sufijos
 */
function cleanNumber(number) {
  return number.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, '');
}


/**
 * Activa el indicador de "Escribiendo..." en WhatsApp
 * @param {string} number - Numero del destinatario
 * @param {number} durationMs - Duracion en ms
 * @returns {Promise<boolean>}
 */
async function sendTypingIndicator(number, durationMs = 2000) {
  try {
    const cleanNum = cleanNumber(number);

    const response = await fetch(`${EVOLUTION_URL}/chat/sendPresence/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: cleanNum,
        delay: durationMs,
        presence: 'composing'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️ sendPresence fallo: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`✅ "Escribiendo..." activado para ${cleanNum} (${durationMs}ms)`);
    return true;

  } catch (err) {
    console.log(`⚠️ Error en sendTypingIndicator: ${err.message}`);
    return false;
  }
}


/**
 * Desactiva el indicador de "Escribiendo..."
 */
async function stopTypingIndicator(number) {
  try {
    const cleanNum = cleanNumber(number);

    await fetch(`${EVOLUTION_URL}/chat/sendPresence/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: cleanNum,
        delay: 0,
        presence: 'available'
      })
    });

  } catch (err) {
    // Silencioso - no es critico
  }
}


/**
 * Calcula tiempo de escritura realista con VARIABILIDAD ALEATORIA
 */
function calculateTypingDuration(text) {
  // 40-70ms por caracter (aleatorio cada vez)
  const msPerChar = 40 + Math.random() * 30;

  let duration = text.length * msPerChar;

  // Tiempo de "pensamiento" antes de escribir (0.5-2 segundos)
  const thinkingTime = 500 + Math.random() * 1500;
  duration += thinkingTime;

  // Pausas por puntuacion (200-500ms cada coma/punto)
  const punctuationPauses = (text.match(/[,.]/g) || []).length * (200 + Math.random() * 300);
  duration += punctuationPauses;

  // Minimo 1.5s, maximo 8s
  duration = Math.max(1500, Math.min(duration, 4000));

  return Math.round(duration);
}


// ============================================
// API PARA EL FRONTEND REACT
// ============================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    const relevantChunks = await searchRelevantChunks(message, 3);
    const context = relevantChunks.join('\n\n');

    console.log(`\n💬 Pregunta: ${message}`);
    console.log(`📄 Contexto usado: ${context.length} caracteres`);

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const prompt = `Usa SOLO esta informacion para responder. Si no sabes, di "No tengo esa informacion en mi base de conocimiento":

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


// Endpoint temporal para limpiar memoria
app.get('/clear-memory', (req, res) => {
  conversationMemory.clear();
  res.json({ message: 'Memoria limpiada' });
});

// ============================================
// WEBHOOK DE WHATSAPP (CORREGIDO)
// ============================================

app.post('/webhook', async (req, res) => {
  // Responder INMEDIATAMENTE a Evolution (importante!)
  res.sendStatus(200);

  try {
    // Memoria de conversaciones (número → array de mensajes)
    const conversationMemory = new Map();
    const MAX_MEMORY = 4; // Solo últimos 2 intercambios (user + assistant)
    const mensaje = req.body.data?.message?.conversation;
    const numero = req.body.data?.key?.remoteJid;
    const nombre = req.body.data?.pushName || 'amigo'; 

    // Ignorar mensajes enviados por mi mismo
    if (req.body.data?.key?.fromMe) return;
    if (!mensaje) return;

    // Detectar si es grupo o privado
    const esGrupo = numero.endsWith('@g.us');

    // Solo requerir @157656052420857 en grupos
    const trigger = '@157656052420857';
    let pregunta = mensaje.trim();

    if (esGrupo) {
      if (!pregunta.toLowerCase().startsWith(trigger)) {
        console.log(`⏩ Ignorado en grupo (no tiene ${trigger}): ${pregunta.substring(0, 50)}...`);
        return;
      }
      pregunta = pregunta.slice(trigger.length).trim();
    }

    console.log(`\n📩 ${esGrupo ? 'Grupo' : 'Privado'} - Pregunta: ${pregunta}`);

    // ===== PASO 1: BUSCAR CHUNKS =====
    const relevantChunks = await searchRelevantChunks(mensaje, 3);
    const context = relevantChunks.join('\n\n');

    // ===== PASO 2: CONSULTAR GEMINI =====
        // Guardar mensaje del usuario en historial
    addToHistory(numero, 'user', mensaje);

    // Obtener historial de conversación
    const history = getConversationHistory(numero);
    const historyText = history.map(h =>
      h.role === 'user' ? `${nombre}: ${h.text}` : `Cúmulo: ${h.text}`
    ).join('\n');

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const prompt = `Eres Cúmulo, un asistente amigable y cercano. Hablas con ${nombre}. Usa su nombre naturalmente en las respuestas. Sé conversacional, como un amigo experto.

Historial de la conversación:
${historyText}

Información de la base de conocimiento:
${context}

Responde de forma amigable y personalizada para ${nombre}. Si no sabes algo, di que no tienes esa información por ahora.

Pregunta actual de ${nombre}: ${mensaje}`;

    const result = await model.generateContent(prompt);
    const respuesta = result.response.text();

    // Guardar respuesta en historial
    addToHistory(numero, 'assistant', respuesta);

    console.log(`🤖 Respuesta: ${respuesta}`);

    // ===== PASO 3: CALCULAR TIEMPO REALISTA =====
    const typingDuration = calculateTypingDuration(respuesta);
    console.log(`⏱️ Tiempo de escritura simulado: ${typingDuration}ms`);

    // ===== PASO 4: MOSTRAR "ESCRIBIENDO..." =====
    // Enviar ANTES de esperar, para que WhatsApp lo muestre inmediatamente
    const typingOk = await sendTypingIndicator(numero, typingDuration);

    if (typingOk) {
      // Esperar el tiempo calculado
      await new Promise(resolve => setTimeout(resolve, typingDuration));

      // Desactivar antes de enviar
      await stopTypingIndicator(numero);
    } else {
      // Si fallo, esperar tiempo minimo
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // ===== PASO 5: ENVIAR RESPUESTA =====
    const cleanNum = cleanNumber(numero);

    const sendResponse = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: cleanNum,
        text: respuesta,
        options: {
          delay: 0
        }
      })
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.log(`❌ Error al enviar mensaje: ${sendResponse.status} - ${errorText}`);
    } else {
      console.log(`✅ Enviado a ${numero}`);
    }

  } catch (error) {
    console.error('❌ Error webhook:', error);
  }
});

// Endpoint temporal para limpiar memoria
app.get('/clear-memory', (req, res) => {
  conversationMemory.clear();
  res.json({ message: 'Memoria limpiada' });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cumulo corriendo en puerto ${PORT}`);
  console.log(`📱 WhatsApp webhook: POST /webhook`);
  console.log(`💬 Chat API: POST /api/chat`);
  console.log(`✍️ Typing indicator: ACTIVADO con variabilidad aleatoria`);
});

// Cargar embeddings en segundo plano
initKnowledgeBase().then(() => {
  console.log('✅ Base de conocimiento lista');
}).catch(err => {
  console.error('❌ Error al cargar embeddings:', err);
});