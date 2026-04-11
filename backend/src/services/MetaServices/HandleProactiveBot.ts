import * as Sentry from "@sentry/node";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import ProactiveBotSession from "../../models/ProactiveBotSession";
import { MetaApiClient } from "../../clients/MetaApiClient";
import ChatbotResponseHelper from "./Chatbot/ChatbotResponseHelper";
import ReportProactiveBotResultService from "./ReportProactiveBotResultService";

interface HandleProactiveBotValidationParams {
  ticket: Ticket;
  messageBody: string;
  buttonPayload: string;
  contact: Contact;
  whatsapp: Whatsapp;
}

/**
 * Maneja la validación inicial del bot proactivo (SI/NO a la plantilla)
 * y el flujo de feedback cuando el usuario rechaza
 */
const HandleProactiveBot = async ({
  ticket,
  messageBody,
  buttonPayload,
  contact,
  whatsapp
}: HandleProactiveBotValidationParams): Promise<void> => {
  try {
    console.log(`[HandleProactiveBotValidation] Procesando bot proactivo - Step: ${ticket.chatbotMessageLastStep}`);

    // CASO A: Usuario está navegando el bot principal (aceptó continuar)
    if (ticket.chatbotMessageLastStep &&
        !ticket.chatbotMessageLastStep.startsWith('inactividad_feedback') &&
        ticket.chatbotMessageLastStep !== null) {
      console.log(`[HandleProactiveBotValidation] Usuario navegando bot principal - Step: ${ticket.chatbotMessageLastStep}`);

      // Delegar a ChatbotResponseHelper para manejar la navegación
      await ChatbotResponseHelper.processUserResponse({
        ticket,
        userMessage: messageBody,
        selectedOptionId: buttonPayload,
        contact,
        whatsapp
      });

      // Verificar si el bot terminó (sin más opciones)
      await ticket.reload();

      if (ticket.chatbotFinishedAt) {
        // El bot principal terminó exitosamente
        console.log(`[HandleProactiveBotValidation] Bot principal completado exitosamente, cerrando ticket`);

        // Actualizar sesión como COMPLETED
        const session = await ProactiveBotSession.findOne({
          where: { ticketId: ticket.id, status: 'ACTIVE' }
        });

        if (session) {
          await session.update({
            status: 'COMPLETED',
            completedAt: new Date(),
            userResponsesHistory: session.userResponsesHistory +
              `\n[${new Date().toISOString()}] Usuario completó el bot exitosamente`
          });

          // Reportar como completado
          await ReportProactiveBotResultService({ session });
          console.log(`[HandleProactiveBotValidation] Sesión reportada como COMPLETED`);
        }
      }

      return;
    }

    // CASO B: Usuario está en flujo de feedback
    if (ticket.chatbotMessageLastStep && ticket.chatbotMessageLastStep.startsWith('inactividad_feedback')) {
      console.log(`[HandleProactiveBotValidation] Procesando respuesta de feedback`);

      // Delegar a ChatbotResponseHelper para manejar la selección
      await ChatbotResponseHelper.processUserResponse({
        ticket,
        userMessage: messageBody,
        selectedOptionId: buttonPayload,
        contact,
        whatsapp
      });

      // Verificar si el bot terminó (sin más opciones)
      await ticket.reload();

      if (ticket.chatbotFinishedAt) {
        // El bot terminó el flujo de feedback
        console.log(`[HandleProactiveBotValidation] Flujo de feedback completado, cerrando ticket`);

        // Cerrar ticket
        await ticket.update({
          status: 'closed'
        });

        // Actualizar sesión como DECLINED con feedback
        const session = await ProactiveBotSession.findOne({
          where: { ticketId: ticket.id, status: 'ACTIVE' }
        });

        if (session) {
          await session.update({
            status: 'DECLINED',
            completedAt: new Date(),
            userResponsesHistory: session.userResponsesHistory +
              `\n[${new Date().toISOString()}] Usuario seleccionó: "${messageBody}" - Feedback completado`
          });

          // Reportar con feedback incluido
          await ReportProactiveBotResultService({ session });
          console.log(`[HandleProactiveBotValidation] Sesión reportada como DECLINED con feedback`);
        }
      }

      return;
    }

    // CASO C: Validación inicial (SI/NO a plantilla)
    console.log(`[HandleProactiveBotValidation] Procesando validación inicial: ${messageBody}`);

    const userResponse = messageBody.toLowerCase().trim();

    // CASO 1: Usuario dice SI
    if (userResponse.includes('sí') ||
        userResponse.includes('si') ||
        userResponse.includes('continuar') ||
        buttonPayload === 'CONTINUE_YES') {

      console.log(`[HandleProactiveBotValidation] Usuario confirmó continuar, iniciando bot`);

      // Delegar envío de mensaje raíz a ChatbotResponseHelper
      await ChatbotResponseHelper.sendRootMessage(ticket, contact, whatsapp);

      // Actualizar ProactiveBotSession
      const session = await ProactiveBotSession.findOne({
        where: { ticketId: ticket.id, status: 'ACTIVE' }
      });

      if (session) {
        await session.update({
          currentStep: ticket.chatbotMessageLastStep,
          userResponsesHistory: session.userResponsesHistory +
            `\n[${new Date().toISOString()}] Usuario respondió: "${messageBody}" - Aceptó continuar`
        });
      }

      return;
    }

    // CASO 2: Usuario dice NO
    if (userResponse.includes('no') ||
        userResponse.includes('gracias') ||
        buttonPayload === 'CONTINUE_NO') {

      console.log(`[HandleProactiveBotValidation] Usuario rechazó continuar, solicitando feedback`);

      // Intentar enviar mensaje de feedback usando ChatbotResponseHelper
      try {
        await ChatbotResponseHelper.sendRootMessage(ticket, contact, whatsapp, 'inactividad_feedback');

        // Actualizar sesión
        const session = await ProactiveBotSession.findOne({
          where: { ticketId: ticket.id, status: 'ACTIVE' }
        });

        if (session) {
          await session.update({
            currentStep: ticket.chatbotMessageLastStep,
            userResponsesHistory: session.userResponsesHistory +
              `\n[${new Date().toISOString()}] Usuario respondió: "${messageBody}" - Rechazó continuar`
          });
        }
      } catch (error) {
        // Si no existe el nodo de feedback, enviar mensaje simple y cerrar
        console.warn(`[HandleProactiveBotValidation] No se encontró nodo de feedback, usando mensaje simple`);

        const client = new MetaApiClient({
          phoneNumberId: whatsapp.phoneNumberId,
          accessToken: whatsapp.metaAccessToken
        });

        const closeMessage = 'Gracias por tu tiempo. ¡Hasta pronto! 👋';
        const response = await client.sendText({
          to: contact.number,
          body: closeMessage
        });

        const messageId = response.messages[0].id;
        await Message.create({
          id: messageId,
          ticketId: ticket.id,
          contactId: contact.id,
          body: closeMessage,
          fromMe: true,
          mediaType: "chat",
          read: true,
          ack: 1
        });

        await ticket.update({
          chatbotFinishedAt: new Date(),
          status: 'closed'
        });

        const session = await ProactiveBotSession.findOne({
          where: { ticketId: ticket.id, status: 'ACTIVE' }
        });

        if (session) {
          await session.update({
            status: 'DECLINED',
            completedAt: new Date(),
            userResponsesHistory: session.userResponsesHistory +
              `\n[${new Date().toISOString()}] Usuario respondió: "${messageBody}" - Rechazó continuar (sin feedback)`
          });
          await ReportProactiveBotResultService({ session });
        }
      }

      return;
    }

    // CASO 3: Respuesta no reconocida
    console.log(`[HandleProactiveBotValidation] Respuesta no reconocida: ${messageBody}`);
    // No hacer nada, esperar timeout del CRON

  } catch (error) {
    console.error(`[HandleProactiveBotValidation] Error:`, error);
    Sentry.captureException(error);
    throw error;
  }
};

export default HandleProactiveBot;
