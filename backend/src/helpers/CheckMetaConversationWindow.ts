import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

export interface ConversationWindowStatus {
  isOpen: boolean;
  type: "active" | "expired" | "new_contact";
  hoursRemaining: number | null;
  lastIncomingAt: Date | null;
}

/**
 * Verifica si la ventana de conversación de 24 horas está activa
 * para un contacto en una conexión de WhatsApp (Meta API).
 *
 * Busca TODOS los tickets del contacto+whatsapp y encuentra el último mensaje
 * entrante (fromMe: false) a través de todos esos tickets, no solo uno.
 *
 * Según política de Meta:
 * - Solo puedes enviar mensajes de texto libre si el cliente te escribió en las últimas 24h
 * - Si el cliente nunca te ha escrito o pasaron > 24h, DEBES usar plantilla aprobada
 *
 * @param contactId - ID del contacto
 * @param whatsappId - ID de la conexión WhatsApp
 * @returns Objeto con estado de la ventana y tipo de conversación
 */
const CheckMetaConversationWindow = async (
  contactId: number,
  whatsappId: number
): Promise<ConversationWindowStatus> => {
  try {
    // 1. Obtener todos los tickets del contacto+whatsapp
    const tickets = await Ticket.findAll({
      where: { contactId, whatsappId },
      attributes: ["id"]
    });

    const ticketIds = tickets.map(t => t.id);

    // 2. Buscar el último mensaje entrante (del cliente hacia nosotros)
    // en CUALQUIERA de esos tickets
    const whereCondition: any = {
      fromMe: false
    };

    if (ticketIds.length > 0) {
      whereCondition.ticketId = ticketIds;
    } else {
      // Si no hay tickets, no hay mensajes — es un contacto nuevo
      logger.info(
        `[CheckMetaConversationWindow] No tickets found for contact ${contactId} on whatsapp ${whatsappId}`
      );
      return {
        isOpen: false,
        type: "new_contact",
        hoursRemaining: null,
        lastIncomingAt: null
      };
    }

    const lastIncomingMessage = await Message.findOne({
      where: whereCondition,
      order: [["timestamp", "DESC"]]
    });

    // Si no hay mensajes entrantes, es un contacto nuevo (nunca nos escribió)
    if (!lastIncomingMessage) {
      logger.info(
        `[CheckMetaConversationWindow] Contact ${contactId} on whatsapp ${whatsappId}: No incoming messages found — new_contact`
      );
      return {
        isOpen: false,
        type: "new_contact",
        hoursRemaining: null,
        lastIncomingAt: null
      };
    }

    // Calcular tiempo transcurrido desde el último mensaje del cliente
    const now = Math.floor(Date.now() / 1000); // timestamp actual en segundos
    const lastMessageTimestamp = lastIncomingMessage.timestamp;
    const hoursSinceLastMessage = (now - lastMessageTimestamp) / 3600;

    logger.info(
      `[CheckMetaConversationWindow] Contact ${contactId} on whatsapp ${whatsappId}: Last incoming message ${hoursSinceLastMessage.toFixed(2)} hours ago across ${ticketIds.length} ticket(s)`
    );

    // Ventana de 24 horas (usamos 23.833 para dar margen de seguridad de 10 min)
    const windowIsOpen = hoursSinceLastMessage >= 0 && hoursSinceLastMessage < 23.833;
    const lastIncomingAt = new Date(lastMessageTimestamp * 1000);

    if (!windowIsOpen) {
      const hoursRemaining = 0;
      logger.info(
        `[CheckMetaConversationWindow] Contact ${contactId} on whatsapp ${whatsappId}: 24-hour window expired (${hoursSinceLastMessage.toFixed(2)} hours)`
      );
      return {
        isOpen: false,
        type: "expired",
        hoursRemaining,
        lastIncomingAt
      };
    }

    const hoursRemaining = Math.max(0, 23.833 - hoursSinceLastMessage);

    return {
      isOpen: true,
      type: "active",
      hoursRemaining,
      lastIncomingAt
    };
  } catch (err) {
    logger.error(
      `[CheckMetaConversationWindow] Error checking window for contact ${contactId} on whatsapp ${whatsappId}:`,
      err
    );
    // En caso de error, asumimos que es ventana expirada para forzar uso de plantilla
    return {
      isOpen: false,
      type: "expired",
      hoursRemaining: 0,
      lastIncomingAt: null
    };
  }
};

export default CheckMetaConversationWindow;
