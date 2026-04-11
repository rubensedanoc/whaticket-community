import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import ChatbotResponseHelper from "./ChatbotResponseHelper";

interface HandleReactiveBotParams {
  ticket: Ticket;
  messageBody: string;
  buttonPayload: string;
  contact: Contact;
  whatsapp: Whatsapp;
  selectedOptionId?: string;
}

/**
 * Maneja todo el flujo del bot reactivo
 * - Delegar envío de mensaje raíz a ChatbotResponseHelper
 * - Delegar procesamiento de respuestas a ChatbotResponseHelper
 */
class HandleReactiveBot {
  async execute(params: HandleReactiveBotParams): Promise<void> {
    const { ticket, messageBody, buttonPayload, contact, whatsapp, selectedOptionId } = params;

    // Enviar mensaje raíz si es necesario
    if (!ticket.chatbotMessageIdentifier && !ticket.chatbotFinishedAt) {
      await ChatbotResponseHelper.sendRootMessage(ticket, contact, whatsapp);
      return;
    }

    // Procesar respuesta del usuario usando ChatbotResponseHelper
    if (ticket.chatbotMessageIdentifier) {
      await ChatbotResponseHelper.processUserResponse({
        ticket,
        userMessage: messageBody,
        selectedOptionId,
        contact,
        whatsapp
      });
    }
  }
}

export default new HandleReactiveBot();
