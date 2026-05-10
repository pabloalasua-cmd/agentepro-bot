const express = require('express');
const twilio = require('twilio');
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `Eres AgentePro, coach de productividad en español. 
Motivador, cercano y preciso. USA emojis. Max 200 palabras.
Pregunta siempre: estado de ánimo, energía 1-10, y metas del día.`;

const userHistory = {};

app.get('/', (req, res) => {
  res.send('AgentePro OK');
});

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const from = req.body.From || '';
  console.log(`MSG: ${incomingMsg} | KEY: ${!!GEMINI_API_KEY}`);

  if (!userHistory[from]) userHistory[from] = [];
  userHistory[from].push({ role: 'user', parts: [{ text: incomingMsg }] });
  if (userHistory[from].length > 20) userHistory[from] = userHistory[from].slice(-20);

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: userHistory[from],
        generationConfig: { temperature: 0.85, maxOutputTokens: 400 }
      }
    );
    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Hola! Estoy aqui';
    userHistory[from].push({ role: 'model', parts: [{ text: reply }] });
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (err) {
    console.error('ERROR:', JSON.stringify(err.response?.data || err.message));
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Problema tecnico, intentalo de nuevo.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AgentePro en puerto ${PORT}`));
