import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

export type ConversationWindowStatus = 
  | { isOpen: true; type: "active" }
  | { isOpen: false; type: "new_conversation" }
  | { isOpen: false; type: "expired" };

/**
 * Verifica si la ventana de conversación de 24 horas está activa
 * para un ticket de Meta API
 * 
 * Según política de Meta:
 * - Solo puedes enviar mensajes de texto libre si el cliente te escribió en las últimas 24h
 * - Si el cliente nunca te ha escrito o pasaron > 24h, DEBES usar plantilla aprobada
 * 
 * @param ticket - Ticket a verificar
 * @returns Objeto con estado de la ventana y tipo de conversación
 */
const CheckMetaConversationWindow = async (ticket: Ticket): Promise<ConversationWindowStatus> => {
  try {
    // Buscar el último mensaje entrante (del cliente hacia nosotros)
    const lastIncomingMessage = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: false
      },
      order: [["timestamp", "DESC"]]
    });

    // Si no hay mensajes entrantes, es una conversación inicial (cliente nuevo)
    if (!lastIncomingMessage) {
      logger.warn(
        `[CheckMetaConversationWindow] Ticket ${ticket.id}: Conversación inicial - Se requiere plantilla de bienvenida`
      );
      return { isOpen: false, type: "new_conversation" };
    }

    // Calcular tiempo transcurrido desde el último mensaje del cliente
    const now = Math.floor(Date.now() / 1000); // timestamp actual en segundos
    const lastMessageTimestamp = lastIncomingMessage.timestamp;
    const hoursSinceLastMessage = (now - lastMessageTimestamp) / 3600;

    logger.info(
      `[CheckMetaConversationWindow] Ticket ${ticket.id}: Last message ${hoursSinceLastMessage.toFixed(2)} hours ago`
    );

    // Ventana de 24 horas (usamos 23.5 para dar margen de seguridad)
    const windowIsOpen = hoursSinceLastMessage < 23.5;

    if (!windowIsOpen) {
      logger.warn(
        `[CheckMetaConversationWindow] Ticket ${ticket.id}: 24-hour window expired (${hoursSinceLastMessage.toFixed(2)} hours) - Se requiere plantilla de reengagement`
      );
      return { isOpen: false, type: "expired" };
    }

    return { isOpen: true, type: "active" };
  } catch (err) {
    logger.error(`[CheckMetaConversationWindow] Error checking window for ticket ${ticket.id}:`, err);
    // En caso de error, asumimos que es ventana expirada para forzar uso de plantilla
    return { isOpen: false, type: "expired" };
  }
};

export default CheckMetaConversationWindow;
