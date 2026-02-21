import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

/**
 * Verifica si la ventana de conversación de 24 horas está activa
 * para un ticket de Meta API
 * 
 * @param ticket - Ticket a verificar
 * @returns true si la ventana está activa (< 24 horas), false si expiró
 */
const CheckMetaConversationWindow = async (ticket: Ticket): Promise<boolean> => {
  try {
    // Buscar el último mensaje entrante (del cliente hacia nosotros)
    const lastIncomingMessage = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: false
      },
      order: [["timestamp", "DESC"]]
    });

    // Si no hay mensajes entrantes, la ventana no está activa
    if (!lastIncomingMessage) {
      logger.info(
        `[CheckMetaConversationWindow] No incoming messages found for ticket ${ticket.id}, window is closed`
      );
      return false;
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
        `[CheckMetaConversationWindow] Ticket ${ticket.id}: 24-hour window expired (${hoursSinceLastMessage.toFixed(2)} hours)`
      );
    }

    return windowIsOpen;
  } catch (err) {
    logger.error(`[CheckMetaConversationWindow] Error checking window for ticket ${ticket.id}:`, err);
    // En caso de error, asumimos que la ventana está cerrada para forzar uso de plantilla
    return false;
  }
};

export default CheckMetaConversationWindow;
