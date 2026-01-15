import { emitEvent } from "../libs/emitEvent";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  // console.log("--- SetTicketMessagesAsRead ticketId:", ticket.id);

  await Message.update(
    { read: true },
    {
      where: {
        ticketId: ticket.id,
        read: false
      }
    }
  );

  await ticket.update({ unreadMessages: 0 });

  try {
    const wbot = await GetTicketWbot(ticket);
    
    // Verificar que el wbot esté disponible antes de intentar sendSeen
    if (!wbot) {
      logger.warn(
        `[SetTicketMessagesAsRead] No wbot available for ticketId ${ticket.id}, whatsappId ${ticket.whatsappId}`
      );
      return;
    }
    
    try {
      const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
      await wbot.sendSeen(chatId);
      
      // Log exitoso solo si hay problemas recurrentes (comentado por defecto)
      // logger.info(`[SetTicketMessagesAsRead] Messages marked as read for ticketId ${ticket.id}`);
    } catch (sendSeenErr) {
      // Con el parche aplicado en wbot.ts, este error debería ser menos frecuente
      // Si aún ocurre, puede ser por desconexión temporal o problemas de red
      logger.warn(
        `[SetTicketMessagesAsRead] Could not mark messages as read for ticketId ${ticket.id}, whatsappId ${ticket.whatsappId}, contact ${ticket.contact.number}. Error: ${sendSeenErr.message || sendSeenErr}`
      );
    }
  } catch (err) {
    // Error al obtener wbot - probablemente sesión no inicializada o desconectada
    logger.warn(
      `[SetTicketMessagesAsRead] Could not get wbot for ticketId ${ticket.id}, whatsappId ${ticket.whatsappId}. Session might be disconnected. Error: ${err.message || err}`
    );
  }

  emitEvent({
    to: [ticket.status],
    event: {
      name: "ticket",
      data: {
        action: "updateUnread",
        ticketId: ticket.id
      }
    }
  });
};

export default SetTicketMessagesAsRead;
