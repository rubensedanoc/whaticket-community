import { subMinutes } from "date-fns";
import { Op } from "sequelize";
import ChatbotMessage from "../../models/ChatbotMessage";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import ProactiveBotSession from "../../models/ProactiveBotSession";
import { logger } from "../../utils/logger";
import ChatbotResponseHelper from "../MetaServices/Chatbot/ChatbotResponseHelper";
import ReportProactiveBotResultService from "../MetaServices/Chatbot/ReportProactiveBotResultService";

/**
 * Revisa tickets con chatbot activo y envía mensaje de expiración
 * si el usuario no ha respondido en el tiempo configurado
 * @param chatbotIdentifier - Identificador del tipo de chatbot ('soporte', 'inactividad', etc.), undefined para todos
 */
const CheckExpiredChatbotSessions = async (chatbotIdentifier?: string): Promise<void> => {
  const cronStartTime = Date.now();
  const botLabel = chatbotIdentifier ? ` (${chatbotIdentifier})` : '';

  try {
    // Buscar tickets con chatbot activo
    const ticketsWithActiveBot = await Ticket.findAll({
      where: {
        chatbotMessageIdentifier: {
          [Op.ne]: null  // Tiene chatbot asociado
        },
        chatbotFinishedAt: null,  // Chatbot no ha terminado
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
          required: true,
          ...(chatbotIdentifier && {
            where: { chatbotIdentifier }
          })
        }
      ]
    });

    let expiredCount = 0;
    let errorCount = 0;

    for (const ticket of ticketsWithActiveBot) {
      try {
        // Buscar configuración del chatbot RAÍZ (el timeout está configurado en el raíz, no en las opciones)
        const chatbotMessage = await ChatbotMessage.findOne({
          where: {
            identifier: ticket.chatbotMessageIdentifier,
            isActive: true,
            wasDeleted: false
          }
        });

        if (!chatbotMessage || !chatbotMessage.timeToWaitInMinutes) {
          continue;
        }

        // Calcular tiempo de expiración
        const validTime = subMinutes(new Date(), chatbotMessage.timeToWaitInMinutes);
        const lastActivityTime = ticket.lastBotMessageAt || ticket.updatedAt;

        if (new Date(lastActivityTime) < validTime) {
          // Enviar mensaje de timeout solo para Meta API
          if (ticket.whatsapp.apiType === "meta-api") {
            await ChatbotResponseHelper.sendTimeoutMessage(
              ticket,
              ticket.contact,
              ticket.whatsapp
            );
          }

          // Finalizar chatbot y cerrar ticket
          await ticket.update({
            chatbotMessageLastStep: null,
            chatbotFinishedAt: new Date(),
            status: "closed"
          });

          // Si es bot proactivo, actualizar sesión y reportar
          const proactiveSession = await ProactiveBotSession.findOne({
            where: { ticketId: ticket.id, status: 'ACTIVE' }
          });

          if (proactiveSession) {
            const timeoutType = ticket.chatbotMessageLastStep === null ? 'NO_RESPONSE' : 'TIMEOUT';
            const statusMessage = timeoutType === 'NO_RESPONSE'
              ? 'Usuario no respondió a la plantilla'
              : 'Sesión expirada por inactividad';

            await proactiveSession.update({
              status: timeoutType,
              completedAt: new Date(),
              userResponsesHistory: proactiveSession.userResponsesHistory +
                `\n[${new Date().toISOString()}] ${statusMessage}`
            });

            await ReportProactiveBotResultService({ session: proactiveSession });
          }

          expiredCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error(`CRON CheckExpiredChatbotSessions - Error ticket ${ticket.id}:`, error);
      }
    }

    if (expiredCount > 0 || errorCount > 0) {
      logger.info(
        `CheckExpiredChatbotSessions${botLabel}: ${expiredCount} expirados, ${errorCount} errores (${Date.now() - cronStartTime}ms)`
      );
    }
  } catch (error) {
    logger.error(`CheckExpiredChatbotSessions${botLabel} - Error crítico:`, error);
  }
};

export default CheckExpiredChatbotSessions;
