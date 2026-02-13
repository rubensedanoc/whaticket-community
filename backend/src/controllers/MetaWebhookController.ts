import { Request, Response } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger";
import MetaMessageService, { WhatsAppValue } from "../services/MetaWebhookService/MetaMessageService";

export const verifyWebhook = async (req: Request, res: Response): Promise<Response> => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("Meta Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  logger.warn("Meta Webhook verification failed");
  return res.status(403).json({ error: "Verification failed" });
};

export const receiveWebhook = async (req: Request, res: Response): Promise<Response> => {
  try {
    logger.info("Webhook request received", {
      headers: req.headers,
      body: req.body
    });

    const appSecret = process.env.META_APP_SECRET;
    const signature = req.headers["x-hub-signature-256"] as string;

    // Validación HMAC (solo si META_APP_SECRET está configurado)
    if (!appSecret) {
      logger.warn("Running in TEST MODE - HMAC validation disabled. Configure META_APP_SECRET for production.");
    } else {
      if (!signature) {
        logger.warn("Missing x-hub-signature-256 header");
        return res.status(401).json({ error: "Missing signature" });
      }

      // Usar raw body en lugar de JSON.stringify para validación correcta
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

      const signatureHash = signature.split("=")[1];

      if (signatureHash !== expectedSignature) {
        logger.warn("Invalid signature in webhook request");
        return res.status(401).json({ error: "Invalid signature" });
      }

      logger.info("Signature validated successfully");
    }

    const { object, entry } = req.body;

    if (object !== "whatsapp_business_account") {
      logger.warn(`Unexpected webhook object type: ${object}`);
      return res.status(400).json({ error: "Invalid object type" });
    }

    logger.info("Meta Webhook received", {entries: entry?.length || 0});

    // Responder 200 inmediatamente según documentación de Meta
    res.status(200).json({ success: true });

    // Procesar mensajes de forma asíncrona sin bloquear la respuesta
    setImmediate(async () => {
      try {
        for (const item of entry || []) {
          const changes = item.changes || [];

          for (const change of changes) {
            if (change.field === "messages") {
              const value: WhatsAppValue = change.value;

              if (value.messages) {
                for (const message of value.messages) {
                  try {
                    const processedMessage = MetaMessageService.processMessage(message, value);
                    await MetaMessageService.handleIncomingMessage(processedMessage);
                  } catch (error) {
                    logger.error("Error processing message", { error, message });
                  }
                }
              }

              if (value.statuses) {
                for (const status of value.statuses) {
                  try {
                    const messageStatus = MetaMessageService.processMessageStatus(status);
                    await MetaMessageService.handleMessageStatus(messageStatus);
                  } catch (error) {
                    logger.error("Error processing status", { error, status });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error("Error in async webhook processing", error);
      }
    });

    return res;
  } catch (error) {
    logger.error("Error processing webhook", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
