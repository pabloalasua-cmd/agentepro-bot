const express = require('express');
const twilio = require('twilio');
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const SYSTEM_PROMPT = `Eres AgentePro, un agente de productividad personal en español. Tu personalidad:
- 🔥 Motivador y enérgico como un coach deportivo
- 😊 Cercano y cálido como un amigo que te conoce bien
- 💼 Preciso y ejecutivo cuando das planes

SIEMPRE responde en español. NUNCA en inglés.

FORMATO de tus respuestas:
- Emojis al inicio de secciones para dar estructura visual
- Máximo 250 palabras, denso y útil
- Termina con una pregunta de seguimiento o micro-acción concreta

TUS FUNCIONES:
1. CHECK-IN: Cuando el usuario comparte su estado emocional o energía, analízalo y adapta tu plan. Si está cansado → sesiones cortas 25 min. Si está con energía → bloques 90 min.
2. PLANIFICACIÓN: Propón bloques Pomodoro concretos con horarios reales.
3. METAS: Haz seguimiento activo. Celebra logros con entusiasmo.
4. MOTIVACIÓN: Personalizada según su estado. Nunca genérica.
5. BIENESTAR: Sugiere pausas, agua, movimiento. Detecta señales de burnout.

PRIMERA VEZ: Preséntate brevemente y pregunta cómo están hoy física y mentalmente, nivel de energía del 1-10, y sus 3 metas principales del día.`;

// Historial de conversación por usuario
const userHistory = {};

app.get('/', (req, res) => {
  res.send('AgentePro Bot funcionando ✅');
});

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body || '';
  const from = req.body.From || '';

  console.log(`Mensaje de ${from}: ${incomingMsg}`);

  // Inicializar historial si no existe
  if (!userHistory[from]) {
    userHistory[from] = [];
  }

  // Añadir mensaje del usuario al historial
  userHistory[from].push({
    role: 'user',
    parts: [{ text: incomingMsg }]
  });

  // Limitar historial a últimos 20 mensajes
  if (userHistory[from].length > 20) {
    userHistory[from] = userHistory[from].slice(-20);
  }

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: userHistory[from],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 400,
          topP: 0.95
        }
      }
    );

    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '¡Hola! Estoy aquí para ayudarte 💪';

    // Añadir respuesta al historial
    userHistory[from].push({
      role: 'model',
      parts: [{ text: reply }]
    });

    // Responder via Twilio
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (err) {
    console.error('Error Gemini:', err.response?.data || err.message);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('⚠️ Error procesando tu mensaje. Intenta de nuevo.');

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AgentePro corriendo en puerto ${PORT} 🚀`);
});
