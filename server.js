require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const app = express();
app.use(express.json());

// 1. Cargar tu base de conocimiento de los json
const conocimiento = JSON.parse(fs.readFileSync('./data.json', 'utf8')); 

// 2. Conectar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 3. Esta es la ruta que va a llamar WhatsApp
app.post('/webhook', async (req, res) => {
  const mensaje = req.body.data?.message?.conversation;
  const numero = req.body.data?.key?.remoteJid;

  if (!mensaje) return res.sendStatus(200);

  // 4. Preguntarle a Gemini usando tu json como contexto
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Usa solo esta información para responder: ${JSON.stringify(conocimiento)}. 
  Pregunta del usuario: ${mensaje}`;

  const result = await model.generateContent(prompt);
  const respuesta = result.response.text();

  console.log(`Responder a ${numero}: ${respuesta}`);
  // Aquí después le diremos a Evolution que envíe la respuesta
  
  res.json({ reply: respuesta }); // por ahora solo la devuelve
});

app.listen(process.env.PORT || 3000);
