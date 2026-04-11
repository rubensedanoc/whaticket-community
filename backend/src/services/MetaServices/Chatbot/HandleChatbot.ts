import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import Whatsapp from "../../../models/Whatsapp";
import HandleReactiveBot from "./HandleReactiveBot";
import HandleProactiveBot from "../HandleProactiveBot";

interface HandleChatbotParams {
  ticket: Ticket;
  messageBody: string;
  buttonPayload: string;
  contact: Contact;
  whatsapp: Whatsapp;
  shouldSkipBot: boolean;
  selectedOptionId?: string;
}

/**
 * Orquestador principal del flujo del chatbot
 * - Punto de entrada único para cualquier interacción de bot
 * - Decide tipo de ejecución (reactive/proactive)
 * - Valida condiciones previas
 * - Delega al handler correspondiente
 */
class HandleChatbot {
  async execute(params: HandleChatbotParams): Promise<void> {

    const { ticket, messageBody, buttonPayload, contact, whatsapp, shouldSkipBot, selectedOptionId } = params;

    // Validar si se debe omitir el bot
    if (this.shouldSkip(shouldSkipBot, ticket.chatbotFinishedAt)) {
      return;
    }

    // Determinar tipo de bot y delegar
    const botType = this.determineBotType(whatsapp, ticket);

    switch (botType) {
      case 'proactive':
        console.log(`[HandleChatbot] Delegando a HandleProactiveBotValidation`);
        const optionId = selectedOptionId || buttonPayload;
        await HandleProactiveBot({ ticket, messageBody, buttonPayload: optionId, contact, whatsapp });
        break;

      case 'reactive':
        console.log(`[HandleChatbot] Delegando a HandleReactiveBot`);
        await HandleReactiveBot.execute({ ticket, messageBody, buttonPayload, contact, whatsapp, selectedOptionId });
        break;

      case 'none':
        console.log(`[HandleChatbot] No se determinó tipo de bot, omitiendo`);
        break;
    }
  }

  /**
   * Valida si se debe omitir el procesamiento del bot
   */
  private shouldSkip(shouldSkipBot: boolean, chatbotFinishedAt: Date | null): boolean {
    if (shouldSkipBot) {
      console.log(`[HandleChatbot] shouldSkipBot es true, omitiendo`);
      return true;
    }

    if (chatbotFinishedAt) {
      console.log(`[HandleChatbot] Bot ya finalizado el ${chatbotFinishedAt}, permitiendo interacción humana`);
      return true;
    }

    return false;
  }

  /**
   * Determina el tipo de bot basado en el whatsapp y ticket
   */
  private determineBotType(whatsapp: Whatsapp, ticket: Ticket): 'proactive' | 'reactive' | 'none' {
    if (whatsapp.executionType == 'proactive' && ticket.chatbotMessageIdentifier == whatsapp.chatbotIdentifier && ticket.chatbotFinishedAt == null) {
      return 'proactive';
    }

    if (whatsapp.executionType == 'reactive') {
      return 'reactive';
    }

    return 'none';
  }
}

export default new HandleChatbot();
