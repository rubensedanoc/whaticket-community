import { subMinutes } from "date-fns";
import { Op } from "sequelize";
import ChatbotMessage from "../../models/ChatbotMessage";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import SendChatbotTimeoutMessageMeta from "../MetaServices/SendChatbotTimeoutMessageMeta";

/**
 * Revisa tickets con chatbot activo y envía mensaje de expiración
 * si el usuario no ha respondido en el tiempo configurado
 */
const CheckExpiredChatbotSessions = async (): Promise<void> => {
  const cronStartTime = Date.now();
  logger.info(`[${new Date().toISOString()}] CRON START CheckExpiredChatbotSessions`);

  try {
    // Buscar todos los tickets con chatbot activo (esperando respuesta del usuario)
    // IMPORTANTE: Excluir bots proactivos (lastBotMessageAt != null) para evitar colisión con CheckExpiredProactiveBotTickets
    const ticketsWithActiveBot = await Ticket.findAll({
      where: {
        chatbotMessageIdentifier: {
          [Op.ne]: null  // Bot activo
        },
        lastBotMessageAt: null,  // Solo bots reactivos (excluir proactivos)
        userId: null,  // Sin agente asignado
        status: {
          [Op.or]: ["pending", "open"]
        }
      },
      include: [
        {
          model: Contact,
          as: "contact",
          required: true
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          required: true
        }
      ]
    });

    logger.info(
      `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - Found ${ticketsWithActiveBot.length} tickets with active chatbot`
    );

    let expiredCount = 0;
    let errorCount = 0;

    for (const ticket of ticketsWithActiveBot) {
      try {
        // Buscar configuración del chatbot RAÍZ (el timeout está configurado en el raíz, no en las opciones)
        const chatbotMessage = await ChatbotMessage.findOne({
          where: {
            identifier: ticket.chatbotMessageIdentifier,  // Siempre buscar el mensaje raíz
            isActive: true,
            wasDeleted: false
          }
        });

        if (!chatbotMessage || !chatbotMessage.timeToWaitInMinutes) {
          // Sin timeout configurado en el raíz, saltar
          continue;
        }

        // Calcular tiempo de expiración
        const validTime = subMinutes(new Date(), chatbotMessage.timeToWaitInMinutes);

        // Verificar si el ticket expiró (usuario no respondió en el tiempo establecido)
        // Usar lastBotMessageAt si existe, sino usar updatedAt (fallback para tickets antiguos)
        const lastActivityTime = ticket.lastBotMessageAt || ticket.updatedAt;

        if (new Date(lastActivityTime) < validTime) {
          logger.info(
            `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - Ticket ${ticket.id} expired (lastActivityTime: ${lastActivityTime}, validTime: ${validTime.toISOString()})`
          );

          // Enviar mensaje de expiración solo para Meta API
          logger.info(
            `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - Ticket ${ticket.id} whatsapp.apiType: ${ticket.whatsapp.apiType}`
          );

          if (ticket.whatsapp.apiType === "meta-api") {
            logger.info(
              `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - Sending timeout message for ticket ${ticket.id}`
            );

            await SendChatbotTimeoutMessageMeta({
              ticket,
              contact: ticket.contact,
              whatsapp: ticket.whatsapp
            });
          } else {
            logger.warn(
              `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - Ticket ${ticket.id} skipped (apiType: ${ticket.whatsapp.apiType}, not meta)`
            );
          }

          // Finalizar chatbot y cerrar ticket
          await ticket.update({
            // chatbotMessageIdentifier: mantener para trazabilidad
            chatbotMessageLastStep: null,
            chatbotFinishedAt: new Date(),
            status: "closed"
          });

          expiredCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error(
          `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - Error processing ticket ${ticket.id}`,
          error
        );
      }
    }

    const cronElapsed = Date.now() - cronStartTime;
    logger.info(
      `[${new Date().toISOString()}] CRON END CheckExpiredChatbotSessions - checked: ${ticketsWithActiveBot.length} - expired: ${expiredCount} - errors: ${errorCount} - elapsed: ${cronElapsed}ms`
    );
  } catch (error) {
    const cronElapsed = Date.now() - cronStartTime;
    logger.error(
      `[${new Date().toISOString()}] CRON CheckExpiredChatbotSessions - CRITICAL ERROR - elapsed: ${cronElapsed}ms`,
      error
    );
  }
};

export default CheckExpiredChatbotSessions;
