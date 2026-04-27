import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import ChatbotResponseHelper, { extractSupportData, isValidDomain } from "./ChatbotResponseHelper";

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
 * - Validar si debe omitir el bot
 * - Delegar envío de mensaje raíz a ChatbotResponseHelper
 * - Delegar procesamiento de respuestas a ChatbotResponseHelper
 * - Manejar mensajes de paciencia cuando el bot finalizó
 */
class HandleReactiveBot {
  async execute(params: HandleReactiveBotParams): Promise<void> {
    const { ticket, messageBody, buttonPayload, contact, whatsapp, selectedOptionId } = params;

    // Detectar y procesar mensaje de soporte externo de RestPe Mobile (solo al inicio)
    if (!ticket.chatbotMessageIdentifier && !ticket.chatbotFinishedAt) {
      const supportData = extractSupportData(messageBody);
      if (supportData) {
        console.log(`[HandleReactiveBot] Detectado mensaje de soporte de RestPe Mobile para ticket ${ticket.id}`);
        
        // Actualizar dominio del contacto si viene y es válido
        if (supportData.dominio && isValidDomain(supportData.dominio)) {
          await contact.update({ domain: supportData.dominio });
          console.log(`[HandleReactiveBot] Actualizado contact.domain a: ${supportData.dominio}`);
        } else if (supportData.dominio) {
          console.warn(`[HandleReactiveBot] Dominio inválido detectado: ${supportData.dominio}`);
        }
        
        // Guardar datos adicionales en el ticket (sin forzar bot específico)
        await ticket.update({ externalSupportData: JSON.stringify(supportData) });
        console.log(`[HandleReactiveBot] Datos de soporte guardados en ticket ${ticket.id}`);
        
        // Continuar con el flujo normal (no forzar bot específico)
      }
    }

    // Verificar si enviar mensaje de paciencia
    // Solo cuando el bot finalizó, sin asesor asignado y en estado pending
    if (ticket.chatbotFinishedAt && !ticket.userId && ticket.status === 'pending' && ticket.chatbotMessageIdentifier === 'soporte') {
      await ChatbotResponseHelper.sendPatienceMessage(ticket, contact, whatsapp);
    }

    // Validar si el bot ya finalizó (permitir interacción humana)
    if (ticket.chatbotFinishedAt) {
      console.log(`[HandleReactiveBot] Bot ya finalizado el ${ticket.chatbotFinishedAt}, permitiendo interacción humana`);
      return;
    }

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
