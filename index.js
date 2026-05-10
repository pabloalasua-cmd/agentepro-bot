const express = require('express');
const twilio = require('twilio');
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `Eres AgentePro, coach de productividad en español. 
Motivador, cercano y preciso. USA emojis. Max 200 palabras.
Pregunta siempre: estado de ánimo, energía 1-10, y metas del día.`;

const userHistory = {};

app.get('/', (req, res) => res.send('AgentePro OK'));

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const from = req.body.From || '';
  console.log(`MSG: ${incomingMsg} | KEY: ${!!GROQ_API_KEY}`);

  if (!userHistory[from]) userHistory[from] = [];
  userHistory[from].push({ role: 'user', content: incomingMsg });
  if (userHistory[from].length > 20) userHistory[from] = userHistory[from].slice(-20);

  try {
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...userHistory[from]
        ],
        max_tokens: 400,
        temperature: 0.85
      },
      { headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const reply = groqRes.data?.choices?.[0]?.message?.content || 'Hola! Estoy aqui';
    userHistory[from].push({ role: 'assistant', content: reply });

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
