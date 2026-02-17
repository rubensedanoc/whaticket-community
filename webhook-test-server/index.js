const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "BARRATAYSTESTINIT022026";

app.use(express.json());

// GET - Verificación del webhook por Meta
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Verificación webhook recibida:", { mode, token, challenge });

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }

  console.log("❌ Verificación fallida");
  return res.status(403).send("Forbidden");
});

// POST - Recepción de eventos
app.post("/webhooks/meta", (req, res) => {
  const payload = req.body;

  // Responder 200 inmediatamente
  res.status(200).send("EVENT_RECEIVED");

  // Loguear el evento completo
  console.log("📩 Webhook Meta recibido:");
  console.log(JSON.stringify(payload, null, 2));

  // Procesar mensajes si existen
  if (payload.entry) {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { value } = change;
        const phoneNumberId = value.metadata?.phone_number_id;

        if (value.messages) {
          for (const message of value.messages) {
            console.log(`📨 Mensaje de ${message.from}:`, {
              id: message.id,
              type: message.type,
              text: message.text?.body,
              phoneNumberId
            });
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(`📊 Estado:`, {
              id: status.id,
              status: status.status,
              recipient: status.recipient_id
            });
          }
        }
      }
    }
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Webhook Test Server OK");
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook test server corriendo en puerto ${PORT}`);
  console.log(`📌 WEBHOOK_VERIFY_TOKEN: ${WEBHOOK_VERIFY_TOKEN}`);
});
