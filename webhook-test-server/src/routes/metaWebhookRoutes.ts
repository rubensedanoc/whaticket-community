import { Router } from "express";
import {
  verifyWebhook,
  handleWebhookEvent
} from "../controllers/MetaWebhookController";

const metaWebhookRoutes = Router();

// GET - Verificación del webhook por Meta
metaWebhookRoutes.get("/webhooks/meta", verifyWebhook);

// POST - Recepción de eventos
metaWebhookRoutes.post("/webhooks/meta", handleWebhookEvent);

export default metaWebhookRoutes;
