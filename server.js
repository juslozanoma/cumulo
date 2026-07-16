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
// 1. CARGAR CONOCIMIENTO
// ============================================
const conocimiento = JSON.parse(fs.readFileSync('./kb.json', 'utf8'));

// ============================================
// 2. CONECTAR GEMINI
// ============================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================
// 3. CONFIGURACIÓN EVOLUTION API
// ============================================
const EVOLUTION_URL = 'https://evolution-api-5q3w.onrender.com';
const EVOLUTION_API_KEY = 'cumulo2308';
const INSTANCE_NAME = 'whatsapp-cumulo';

// ============================================
// 4. API PARA EL FRONTEND REACT
// ============================================

// Endpoint para que React consulte Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Usa solo esta información para responder: ${JSON.stringify(conocimiento)}. 
    Pregunta del usuario: ${message}`;

    const result = await model.generateContent(prompt);
    const respuesta = result.response.text();

    res.json({ reply: respuesta });
  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

// Endpoint para obtener kb.json (si React lo necesita)
app.get('/api/kb', (req, res) => {
  res.json(conocimiento);
});

// ============================================
// 5. WEBHOOK DE WHATSAPP
// ============================================

app.post('/webhook', async (req, res) => {
  try {
    const mensaje = req.body.data?.message?.conversation;
    const numero = req.body.data?.key?.remoteJid;

    if (req.body.data?.key?.fromMe) return res.sendStatus(200);
    if (!mensaje) return res.sendStatus(200);

    console.log(`📩 WhatsApp de ${numero}: ${mensaje}`);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Usa solo esta información para responder: ${JSON.stringify(conocimiento)}. 
    Pregunta del usuario: ${mensaje}`;

    const result = await model.generateContent(prompt);
    const respuesta = result.response.text();

    console.log(`🤖 Respuesta: ${respuesta}`);

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
// 6. SERVIR REACT (archivos estáticos)
// ============================================

// En desarrollo, Vite maneja el frontend
// En producción, servimos la carpeta dist
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// ============================================
// 7. INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Cúmulo corriendo en puerto ${PORT}`);
  console.log(`📱 WhatsApp webhook: POST /webhook`);
  console.log(`💬 Chat API: POST /api/chat`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
});