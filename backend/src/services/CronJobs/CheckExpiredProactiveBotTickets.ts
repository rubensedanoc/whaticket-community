import { Op } from "sequelize";
import { subMinutes } from "date-fns";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import ProactiveBotSession from "../../models/ProactiveBotSession";
import ChatbotMessage from "../../models/ChatbotMessage";
import { logger } from "../../utils/logger";
import ReportProactiveBotResultService from "../MetaServices/ReportProactiveBotResultService";

/**
 * CRON para detectar y cerrar tickets de bot proactivo expirados
 * Basado en el campo lastBotMessageAt y timeToWaitInMinutes del ChatbotMessage raíz
 */
const CheckExpiredProactiveBotTickets = async (): Promise<void> => {
  try {
    logger.info(
      `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Iniciando verificación`
    );

    // Buscar tickets activos de bot proactivo
    const activeTickets = await Ticket.findAll({
      where: {
        chatbotMessageIdentifier: { [Op.ne]: null },
        chatbotFinishedAt: null,
        lastBotMessageAt: { [Op.ne]: null },
        status: 'open'
      },
      include: [
        { model: Contact, as: 'contact' },
        { model: Whatsapp, as: 'whatsapp' }
      ]
    });

    if (activeTickets.length === 0) {
      logger.info(
        `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - No hay tickets activos`
      );
      return;
    }

    logger.info(
      `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Verificando ${activeTickets.length} tickets activos`
    );

    let expiredCount = 0;
    let errorCount = 0;

    for (const ticket of activeTickets) {
      try {
        // Buscar configuración de timeout del bot
        const chatbotMessage = await ChatbotMessage.findOne({
          where: {
            identifier: ticket.chatbotMessageIdentifier,
            isActive: true,
            wasDeleted: false
          }
        });

        if (!chatbotMessage || !chatbotMessage.timeToWaitInMinutes) {
          // Sin timeout configurado, usar default de 5 minutos
          logger.warn(
            `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Ticket ${ticket.id}: Sin timeToWaitInMinutes configurado, usando default 5 min`
          );
          continue;
        }

        // Calcular tiempo de expiración basado en lastBotMessageAt
        const validTime = subMinutes(new Date(), chatbotMessage.timeToWaitInMinutes);

        // Verificar si el ticket expiró
        if (new Date(ticket.lastBotMessageAt) >= validTime) {
          // Ticket aún válido, continuar
          continue;
        }

        // Ticket expirado
        logger.info(
          `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Ticket ${ticket.id} expirado (lastBotMessageAt: ${ticket.lastBotMessageAt}, timeout: ${chatbotMessage.timeToWaitInMinutes} min)`
        );

        // Buscar sesión asociada
        const session = await ProactiveBotSession.findOne({
          where: { ticketId: ticket.id, status: 'ACTIVE' }
        });

        // Determinar tipo de timeout
        const timeoutType = ticket.chatbotMessageLastStep === null 
          ? 'NO_RESPONSE'  // Nunca respondió a plantilla
          : 'TIMEOUT';      // Empezó pero no terminó

        logger.info(
          `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Ticket ${ticket.id}: ${timeoutType}`
        );

        // Actualizar ticket
        await ticket.update({
          chatbotMessageLastStep: null,
          chatbotFinishedAt: new Date(),
          status: 'closed'
        });

        // Actualizar sesión y reportar
        if (session) {
          const statusMessage = timeoutType === 'NO_RESPONSE' 
            ? 'Usuario no respondió a la plantilla'
            : 'Sesión expirada por inactividad';

          await session.update({
            status: timeoutType,
            completedAt: new Date(),
            userResponsesHistory: session.userResponsesHistory + 
              `\n[${new Date().toISOString()}] ${statusMessage}`
          });

          // Reportar resultado
          await ReportProactiveBotResultService({ session });
          
          logger.info(
            `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Sesión ${session.id} reportada: ${timeoutType}`
          );
        } else {
          logger.warn(
            `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - No se encontró sesión para ticket ${ticket.id}`
          );
        }

        expiredCount++;
      } catch (error) {
        errorCount++;
        logger.error(
          `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Error procesando ticket ${ticket.id}:`,
          error
        );
      }
    }

    logger.info(
      `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Finalizado. Procesados: ${expiredCount}, Errores: ${errorCount}`
    );

  } catch (error) {
    logger.error(
      `[${new Date().toISOString()}] CRON CheckExpiredProactiveBotTickets - Error general:`,
      error
    );
  }
};

export default CheckExpiredProactiveBotTickets;
