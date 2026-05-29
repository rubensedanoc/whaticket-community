import express from "express";
import metaWebhookRoutes from "./routes/metaWebhookRoutes";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Rutas del webhook de Meta
app.use(metaWebhookRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Webhook Test Server OK - Using real MetaWebhookController");
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook test server corriendo en puerto ${PORT}`);
  console.log(`📌 WEBHOOK_VERIFY_TOKEN: ${process.env.WEBHOOK_VERIFY_TOKEN}`);
});
