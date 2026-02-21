import * as Sentry from "@sentry/node";
import Message from "../../models/Message";
import { emitEvent } from "../../libs/emitEvent";
import { MetaWebhookStatus } from "../../types/meta/MetaWebhookTypes";
import { logger } from "../../utils/logger";

interface HandleMetaMessageStatusParams {
  status: MetaWebhookStatus;
}

/**
 * Mapeo de estados de Meta API a valores de ack
 * 0 = pendiente/error
 * 1 = enviado (sent)
 * 2 = recibido por servidor (delivered)
 * 3 = leído (read)
 * -1 = error/failed
 */
const getAckFromStatus = (status: string): number => {
  switch (status) {
    case "sent":
      return 1;
    case "delivered":
      return 2;
    case "read":
      return 3;
    case "failed":
      return -1;
    default:
      return 0;
  }
};

/**
 * Procesa actualizaciones de estado de mensajes desde webhook de Meta
 * Actualiza el campo ack del mensaje en BD y notifica al frontend
 */
const HandleMetaMessageStatus = async ({
  status
}: HandleMetaMessageStatusParams): Promise<void> => {
  try {
    logger.info(`[HandleMetaMessageStatus] Procesando estado: ${status.status} para mensaje: ${status.id}`);

    // Buscar el mensaje en BD
    const message = await Message.findByPk(status.id);

    if (!message) {
      logger.warn(`[HandleMetaMessageStatus] Mensaje no encontrado: ${status.id}`);
      return;
    }

    // Obtener el ack correspondiente al estado
    const newAck = getAckFromStatus(status.status);

    // Si el mensaje falló, loguear el error
    if (status.status === "failed" && status.errors) {
      logger.error(`[HandleMetaMessageStatus] Mensaje ${status.id} falló:`, {
        recipient: status.recipient_id,
        errors: status.errors
      });

      // Actualizar el mensaje con información del error
      await message.update({
        ack: newAck,
        body: message.body + `\n\n❌ Error: ${status.errors[0]?.title || 'Error desconocido'}`
      });
    } else {
      // Actualizar solo el ack
      await message.update({ ack: newAck });
    }

    logger.info(`[HandleMetaMessageStatus] Mensaje ${status.id} actualizado a ack: ${newAck}`);

    // Emitir evento socket para actualizar frontend
    emitEvent({
      to: [message.ticketId.toString()],
      event: {
        name: "appMessage",
        data: {
          action: "update",
          message: message
        }
      }
    });

    logger.info(`[HandleMetaMessageStatus] Evento socket emitido para mensaje: ${status.id}`);

  } catch (err) {
    logger.error("[HandleMetaMessageStatus] Error:", err);
    Sentry.captureException(err);
  }
};

export default HandleMetaMessageStatus;
