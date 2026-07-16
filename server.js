require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const app = express();
app.use(express.json());

// Cargar conocimiento
const conocimiento = JSON.parse(fs.readFileSync('./kb.json', 'utf8'));

// Conectar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuración de Evolution API
const EVOLUTION_URL = 'https://evolution-api-5q3w.onrender.com';
const EVOLUTION_API_KEY = 'cumulo2308';
const INSTANCE_NAME = 'whatsapp-cumulo';

// Webhook: recibir mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    const mensaje = req.body.data?.message?.conversation;
    const numero = req.body.data?.key?.remoteJid;

    // Ignorar mensajes enviados por mí mismo
    if (req.body.data?.key?.fromMe) return res.sendStatus(200);
    if (!mensaje) return res.sendStatus(200);

    console.log(`📩 Mensaje de ${numero}: ${mensaje}`);

    // Preguntar a Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const prompt = `Usa solo esta información para responder: ${JSON.stringify(conocimiento)}. 
    Pregunta del usuario: ${mensaje}`;

    const result = await model.generateContent(prompt);
    const respuesta = result.response.text();

    console.log(`🤖 Respuesta de Gemini: ${respuesta}`);

    // Enviar respuesta de vuelta por WhatsApp
    await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: numero.replace('@s.whatsapp.net', ''), // quitar el sufijo
        text: respuesta
      })
    });

    console.log(`✅ Respuesta enviada a ${numero}`);

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error:', error);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Server running on port', process.env.PORT || 3000);
});
