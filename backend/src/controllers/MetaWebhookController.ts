import { Request, Response } from "express";
import {
  MetaWebhookPayload,
  MetaWebhookVerifyQuery
} from "../types/meta/MetaWebhookTypes";

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

/**
 * GET /webhooks/meta
 * Verificación del webhook por Meta (challenge)
 */
export const verifyWebhook = (req: Request, res: Response): Response => {
  const query = req.query as unknown as MetaWebhookVerifyQuery;

  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }

  console.log("❌ Verificación de webhook fallida");
  return res.status(403).send("Forbidden");
};

/**
 * POST /webhooks/meta
 * Recepción de eventos del webhook (mensajes, estados, etc.)
 */
export const handleWebhookEvent = (req: Request, res: Response): Response => {
  const payload = req.body as MetaWebhookPayload;

  // Responder 200 inmediatamente (Meta requiere respuesta rápida)
  res.status(200).send("EVENT_RECEIVED");

  // Loguear el evento recibido
  console.log("📩 Webhook Meta recibido:", JSON.stringify(payload, null, 2));

  // Procesar cada entry
  if (payload.entry) {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { value } = change;
        const phoneNumberId = value.metadata.phone_number_id;

        // Mensajes entrantes
        if (value.messages) {
          for (const message of value.messages) {
            console.log(`📨 Mensaje recibido de ${message.from}:`, {
              id: message.id,
              type: message.type,
              text: message.text?.body,
              phoneNumberId
            });
          }
        }

        // Estados de mensajes enviados
        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(`📊 Estado de mensaje:`, {
              id: status.id,
              status: status.status,
              recipient: status.recipient_id
            });
          }
        }
      }
    }
  }

  return res;
};
