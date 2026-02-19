import { Request, Response } from "express";
import {
  MetaWebhookPayload,
  MetaWebhookVerifyQuery,
  MetaWebhookMessage,
  MetaWebhookContact
} from "../types/meta/MetaWebhookTypes";
import Whatsapp from "../models/Whatsapp";
import HandleMetaWebhookMessage from "../services/MetaServices/HandleMetaWebhookMessage";

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
 * Extrae el contenido del mensaje según su tipo
 */
const extractMessageContent = (message: MetaWebhookMessage): Record<string, unknown> => {
  switch (message.type) {
    case "text":
      return {
        body: message.text?.body
      };
    case "image":
      return {
        mediaId: message.image?.id,
        mimeType: message.image?.mime_type,
        caption: message.image?.caption
      };
    case "audio":
      return {
        mediaId: message.audio?.id,
        mimeType: message.audio?.mime_type
      };
    case "video":
      return {
        mediaId: message.video?.id,
        mimeType: message.video?.mime_type,
        caption: message.video?.caption
      };
    case "document":
      return {
        mediaId: message.document?.id,
        mimeType: message.document?.mime_type,
        filename: message.document?.filename,
        caption: message.document?.caption
      };
    case "sticker":
      return {
        mediaId: message.sticker?.id,
        mimeType: message.sticker?.mime_type,
        animated: message.sticker?.animated
      };
    default:
      return { raw: message };
  }
};

/**
 * POST /webhooks/meta
 * Recepción de eventos del webhook (mensajes, estados, etc.)
 */
export const handleWebhookEvent = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as MetaWebhookPayload;

  // Responder 200 inmediatamente (Meta requiere respuesta rápida)
  res.status(200).send("EVENT_RECEIVED");

  // Loguear el evento recibido
  console.log("📩 Webhook Meta recibido:", JSON.stringify(payload, null, 2));

  // Procesar cada entry de forma asíncrona (no bloquear respuesta)
  if (payload.entry) {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { value } = change;
        const phoneNumberId = value.metadata.phone_number_id;
        const displayPhoneNumber = value.metadata.display_phone_number;

        // Obtener info del contacto remitente
        const contact: MetaWebhookContact | undefined = value.contacts?.[0];
        const contactName = contact?.profile?.name;
        const contactWaId = contact?.wa_id;

        // Mensajes entrantes
        if (value.messages) {
          for (const message of value.messages) {
            const content = extractMessageContent(message);

            console.log(`📨 [${message.type.toUpperCase()}] Mensaje de ${message.from}:`, {
              id: message.id,
              type: message.type,
              timestamp: message.timestamp,
              contactName,
              contactWaId,
              phoneNumberId,
              displayPhoneNumber,
              content,
              context: message.context,
              referral: message.referral
            });

            // Buscar whatsapp por phoneNumberId
            const whatsapp = await Whatsapp.findOne({
              where: { phoneNumberId }
            });

            if (!whatsapp) {
              console.error(`❌ No se encontró WhatsApp con phoneNumberId: ${phoneNumberId}`);
              continue;
            }

            // Procesar mensaje de forma asíncrona (no esperar)
            HandleMetaWebhookMessage({ payload, whatsapp }).catch(err => {
              console.error("[MetaWebhookController] Error procesando mensaje:", err);
            });
          }
        }

        // Estados de mensajes enviados
        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(`📊 Estado de mensaje:`, {
              id: status.id,
              status: status.status,
              timestamp: status.timestamp,
              recipient: status.recipient_id,
              conversation: status.conversation,
              pricing: status.pricing,
              errors: status.errors
            });

            // TODO: Aquí se actualizará el estado del mensaje en BD
          }
        }

        // Errores
        if (value.errors) {
          for (const error of value.errors) {
            console.error(`❌ Error en webhook:`, {
              code: error.code,
              title: error.title,
              details: error.details
            });
          }
        }
      }
    }
  }
};
