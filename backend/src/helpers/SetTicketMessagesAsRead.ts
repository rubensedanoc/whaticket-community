import { emitEvent } from "../libs/emitEvent";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import { MetaApiClient } from "../clients/MetaApiClient";

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

  // Obtener whatsapp para determinar apiType
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  const apiType = whatsapp?.apiType || "whatsapp-web.js";

  // Manejar según el tipo de API
  if (apiType === "meta-api") {
    // Meta API: Enviar confirmación de lectura vía API
    try {
      if (!whatsapp?.phoneNumberId || !whatsapp?.metaAccessToken) {
        logger.warn(
          `[SetTicketMessagesAsRead] Meta API credentials not configured for ticketId ${ticket.id}`
        );
        return;
      }

      // Obtener el último mensaje entrante (fromMe: false) para marcar como leído
      const lastIncomingMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: false
        },
        order: [["timestamp", "DESC"]]
      });

      if (!lastIncomingMessage) {
        logger.info(
          `[SetTicketMessagesAsRead] No incoming messages to mark as read for ticketId ${ticket.id}`
        );
        return;
      }

      const client = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });

      // Marcar mensaje como leído usando Meta API
      await client.markMessageAsRead(lastIncomingMessage.id);

      logger.info(
        `[SetTicketMessagesAsRead] Meta API: Marked message ${lastIncomingMessage.id} as read`
      );
    } catch (err) {
      logger.warn(
        `[SetTicketMessagesAsRead] Meta API: Could not mark messages as read for ticketId ${ticket.id}. Error: ${err.message || err}`
      );
    }
  } else {
    // WhatsApp Web.js: Usar wbot.sendSeen()
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
