import * as Sentry from "@sentry/node";
import ChatbotMessage from "../../../models/ChatbotMessage";
import Contact from "../../../models/Contact";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { MetaApiClient } from "../../../clients/MetaApiClient";
import { emitEvent } from "../../../libs/emitEvent";
import {
  NAV_BACK_ID,
  NAV_HOME_ID,
  INCIDENCIA_CONFIRM_ID,
  INCIDENCIA_CANCEL_ID,
  INCIDENCIA_CONFIRMATION_OPTIONS,
  appendNavigationRows,
  resolveNavigationTarget
} from "../../ChatbotMessageService/ChatbotNavigationHelper";
import CreateIncidenciaService from "../../ChatbotMessageService/CreateIncidenciaService";

interface PathNode {
  id: number;
  title: string;
  timestamp: string;
}

interface ProcessUserResponseParams {
  ticket: Ticket;
  userMessage: string;
  selectedOptionId: string | undefined;
  contact: Contact;
  whatsapp: Whatsapp;
}

interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
  label?: string;
}

const buildIncidenciaPath = (existingPathJson: string | null, newNode: ChatbotMessage): PathNode[] => {
  let path: PathNode[] = [];
  if (existingPathJson) {
    try {
      path = JSON.parse(existingPathJson);
    } catch (error) {
      console.error("[ChatbotResponseHelper] Error parsing existingPathJson:", error);
      path = [];
    }
  }
  path.push({
    id: newNode.id,
    title: newNode.title,
    timestamp: new Date().toISOString()
  });
  return path;
};

/**
 * Helper con métodos genéricos para procesamiento de respuestas de chatbot
 * Usado tanto por HandleReactiveBot como HandleProactiveBot
 */
class ChatbotResponseHelper {
  /**
   * Procesa la respuesta del usuario al chatbot
   */
  async processUserResponse(params: ProcessUserResponseParams): Promise<void> {
    const { ticket, userMessage, selectedOptionId, contact, whatsapp } = params;

    try {
      console.log(`[ChatbotResponseHelper] Procesando respuesta para ticket ${ticket.id}: "${userMessage}"`);

      // Validar si el bot ya finalizó
      if (ticket.chatbotFinishedAt) {
        console.log(`[ChatbotResponseHelper] Bot ya finalizó el ${ticket.chatbotFinishedAt}, no procesar`);
        return;
      }

      // Buscar el mensaje actual del chatbot
      const chatbotMessageReplied = await ChatbotMessage.findOne({
        where: {
          identifier: ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier
        },
        include: [
          {
            model: ChatbotMessage,
            as: "chatbotOptions",
            where: { wasDeleted: false },
            required: false,
            separate: true,
            order: [["order", "ASC"]]
          }
        ]
      });

      if (!chatbotMessageReplied) {
        console.error(`[ChatbotResponseHelper] No se encontró mensaje del chatbot con identifier: ${ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier}`);
        return;
      }

      // Manejar navegación
      if (await this.handleNavigation(ticket, selectedOptionId, chatbotMessageReplied, whatsapp, contact)) {
        return;
      }

      // PUNTO 1: Manejar confirmación de incidencia
      if (await this.handleIncidenciaConfirmation(ticket, selectedOptionId, chatbotMessageReplied, whatsapp, contact)) {
        return;
      }

      // Si no hay opciones, finalizar bot
      if (!chatbotMessageReplied.chatbotOptions || chatbotMessageReplied.chatbotOptions.length === 0) {
        console.log("[ChatbotResponseHelper] No hay opciones disponibles, finalizando chatbot");
        await ticket.update({ chatbotMessageLastStep: null, chatbotFinishedAt: new Date(), lastBotMessageAt: new Date() });
        return;
      }

      // Buscar opción seleccionada
      const chooseOption = await this.validateAndSelectOption(chatbotMessageReplied, selectedOptionId, userMessage);

      if (!chooseOption) {
        await this.sendErrorMessage(chatbotMessageReplied, ticket, contact, whatsapp);
        return;
      }

      // PUNTO 2: Manejar flujo de incidencias
      await this.handleIncidenciaFlow(ticket, chooseOption, chatbotMessageReplied);

      // Guardar categoría/subcategoría
      await this.saveCategory(ticket, chooseOption, chatbotMessageReplied);

      // Cargar siguiente mensaje
      const nextChatbotMessage = await ChatbotMessage.findOne({
        where: { id: chooseOption.id },
        include: [
          {
            model: ChatbotMessage,
            as: "chatbotOptions",
            where: { wasDeleted: false },
            required: false,
            separate: true,
            order: [["order", "ASC"]]
          }
        ]
      });

      if (!nextChatbotMessage) {
        console.error(`[ChatbotResponseHelper] No se encontró el siguiente mensaje del chatbot con id: ${chooseOption.id}`);
        return;
      }

      // Enviar siguiente mensaje
      await this.sendMessage(contact, nextChatbotMessage, whatsapp, ticket);

      // Actualizar ticket
      await this.updateTicketAfterResponse(ticket, nextChatbotMessage, contact, whatsapp);

      console.log(`[ChatbotResponseHelper] Respuesta procesada exitosamente para ticket ${ticket.id}`);
    } catch (error) {
      console.error(`[ChatbotResponseHelper] Error procesando respuesta:`, error);
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Envía mensaje de sesión expirada por timeout
   */
  async sendTimeoutMessage(ticket: Ticket, contact: Contact, whatsapp: Whatsapp): Promise<void> {
    try {
      console.log(`[ChatbotResponseHelper] Enviando mensaje de timeout para ticket ${ticket.id}`);

      const message = "⏱️ Tu sesión ha expirado por inactividad. Si necesitas ayuda, escríbeme de nuevo y con gusto te atenderé. 😊";

      const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });

      const response = await client.sendText({ to: contact.number, body: message });

      const messageId = response.messages[0].id;

      const timeoutMessage = await this.saveMessageInDB(
        messageId,
        ticket,
        contact,
        message,
        "chat",
        "timeout"
      );

      this.emitSocketEvent(timeoutMessage, ticket, contact);

      console.log(`[ChatbotResponseHelper] Mensaje de sesión expirada enviado para ticket ${ticket.id}`);
    } catch (error) {
      console.error(`[ChatbotResponseHelper] Error enviando mensaje de timeout:`, error);
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Envía mensajes de paciencia cuando el cliente espera atención después de que el bot finalizó
   * Lógica basada en intervalos de tiempo (5 min) en lugar de contar mensajes
   */
  async sendPatienceMessage(ticket: Ticket, contact: Contact, whatsapp: Whatsapp): Promise<void> {
    try {
      console.log(`[ChatbotResponseHelper] Evaluando mensaje de paciencia para ticket ${ticket.id}`);

      // Verificar que no hayamos alcanzado el límite de mensajes de paciencia
      const currentPatienceCount = ticket.patienceMessageCount || 0;
      if (currentPatienceCount >= 3) {
        console.log(`[ChatbotResponseHelper] Límite de mensajes de paciencia alcanzado (${currentPatienceCount}/3) para ticket ${ticket.id}`);
        return;
      }

      const now = new Date();
      const fiveMinutesInMs = 5 * 60 * 1000;

      // Determinar desde cuándo calcular el intervalo
      let timeSinceLastEvent: number;
      let referenceTime: Date;

      if (ticket.lastPatienceMessageAt) {
        // Si ya enviamos mensajes de paciencia, calcular desde el último mensaje de paciencia
        referenceTime = new Date(ticket.lastPatienceMessageAt);
        timeSinceLastEvent = now.getTime() - referenceTime.getTime();
        console.log(`[ChatbotResponseHelper] Tiempo desde último mensaje de paciencia: ${Math.floor(timeSinceLastEvent / 1000 / 60)} min`);
      } else {
        // Si es el primer mensaje de paciencia, calcular desde que el bot finalizó
        referenceTime = new Date(ticket.chatbotFinishedAt);
        timeSinceLastEvent = now.getTime() - referenceTime.getTime();
        console.log(`[ChatbotResponseHelper] Tiempo desde bot finalizó: ${Math.floor(timeSinceLastEvent / 1000 / 60)} min`);
      }

      // Verificar si han pasado al menos 5 minutos
      if (timeSinceLastEvent < fiveMinutesInMs) {
        console.log(`[ChatbotResponseHelper] No han pasado 5 min desde último evento (${Math.floor(timeSinceLastEvent / 1000 / 60)} min)`);
        return;
      }

      // Definir mensajes de paciencia según el contador
      const patienceMessages = [
        "⏳ Entendemos tu urgencia. Muy pronto te atenderá un asesor.",
        "🙏 Nuestras disculpas por la espera. Estás en la cola de atención, lo atenderemos apenas se desocupe un asesor.",
        "💙 Agradecemos tu paciencia. Tu solicitud es importante para nosotros, te atenderemos lo más pronto posible."
      ];

      const messageToSend = patienceMessages[currentPatienceCount];

      console.log(`[ChatbotResponseHelper] Enviando mensaje de paciencia ${currentPatienceCount + 1}/3 para ticket ${ticket.id}`);

      const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });

      const response = await client.sendText({ to: contact.number, body: messageToSend });

      const messageId = response.messages[0].id;

      const patienceMessage = await this.saveMessageInDB(
        messageId,
        ticket,
        contact,
        messageToSend,
        "chat",
        "patience"
      );

      this.emitSocketEvent(patienceMessage, ticket, contact);

      // Actualizar contadores
      await ticket.update({ 
        patienceMessageCount: currentPatienceCount + 1,
        lastPatienceMessageAt: now
      });

      console.log(`[ChatbotResponseHelper] Mensaje de paciencia ${currentPatienceCount + 1}/3 enviado para ticket ${ticket.id}`);
    } catch (error) {
      console.error(`[ChatbotResponseHelper] Error enviando mensaje de paciencia:`, error);
      Sentry.captureException(error);
    }
  }

  /**
   * Envía el mensaje raíz del chatbot por identifier
   * @param identifier - Identifier específico a enviar (opcional, por defecto usa whatsapp.chatbotIdentifier)
   */
  async sendRootMessage(ticket: Ticket, contact: Contact, whatsapp: Whatsapp, identifier?: string): Promise<void> {
    const targetIdentifier = identifier || whatsapp.chatbotIdentifier;
    console.log(`[ChatbotResponseHelper] Enviando mensaje raíz para identifier: ${targetIdentifier}`);

    try {
      const chatbotMessage = await ChatbotMessage.findOne({
        where: {
          identifier: targetIdentifier,
          isActive: true,
          wasDeleted: false
        },
        include: [
          {
            model: ChatbotMessage,
            as: "chatbotOptions",
            where: { wasDeleted: false },
            required: false,
            separate: true,
            order: [["order", "ASC"]]
          }
        ]
      });

      if (!chatbotMessage) {
        console.error(`[ChatbotResponseHelper] No se encontró chatbot con identifier: ${targetIdentifier}`);
        return;
      }

      const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });

      let messageId: string;
      let messageBody: string;

      if (chatbotMessage.hasSubOptions && chatbotMessage.chatbotOptions && chatbotMessage.chatbotOptions.length > 0) {
        const rows = this.formatInteractiveListRows(chatbotMessage.chatbotOptions);
        const rowsWithNav = await appendNavigationRows(
          rows,
          chatbotMessage,
          chatbotMessage.identifier,
          whatsapp.chatbotIdentifier
        );
        const rowsForMeta = rowsWithNav.map(({ label, ...row }) => row);

        const response = await client.sendInteractiveList({
          to: contact.number,
          bodyText: `\u200e${chatbotMessage.value}`,
          buttonText: "Ver opciones",
          sections: [{ rows: rowsForMeta }]
        });

        messageId = response.messages[0].id;
        const optionsText = this.formatInteractiveListOptionsAsText(rowsWithNav);
        messageBody = `\u200e${chatbotMessage.value}${optionsText}`;
      } else {
        const response = await client.sendText({
          to: contact.number,
          body: `\u200e${chatbotMessage.value}`
        });

        messageId = response.messages[0].id;
        messageBody = `\u200e${chatbotMessage.value}`;
      }

      // Guardar mensaje en BD
      const botMessage = await this.saveMessageInDB(
        messageId,
        ticket,
        contact,
        messageBody,
        chatbotMessage.mediaType || "chat",
        chatbotMessage.identifier
      );

      // Emitir evento socket
      this.emitSocketEvent(botMessage, ticket, contact);

      // Actualizar ticket
      await ticket.update({ chatbotMessageIdentifier: targetIdentifier, chatbotMessageLastStep: chatbotMessage.identifier, lastBotMessageAt: new Date() });

      console.log(`[ChatbotResponseHelper] Mensaje raíz enviado para ticket ${ticket.id}`);
    } catch (error) {
      console.error("[ChatbotResponseHelper] Error enviando mensaje raíz:", error);
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Maneja navegación (Volver/Menú principal)
   */
  private async handleNavigation(
    ticket: Ticket,
    selectedOptionId: string | undefined,
    chatbotMessageReplied: ChatbotMessage,
    whatsapp: Whatsapp,
    contact: Contact
  ): Promise<boolean> {
    if (selectedOptionId === NAV_BACK_ID || selectedOptionId === NAV_HOME_ID) {
      const navAction = selectedOptionId === NAV_BACK_ID ? "back" : "home";
      const currentIdentifier = ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier;

      console.log(`[ChatbotResponseHelper] Navegación detectada: "${navAction}" desde ${currentIdentifier}`);

      // Limpiar pathJson de incidencia al navegar a home
      if (selectedOptionId === NAV_HOME_ID && ticket.incidenciaPathJson) {
        console.log(`[ChatbotResponseHelper] Limpiando pathJson de incidencia al navegar a home`);
        await ticket.update({ incidenciaPathJson: null });
      }

      const navResult = await resolveNavigationTarget(navAction, currentIdentifier, ticket.chatbotMessageIdentifier);

      if (navResult) {
        const { targetNode, newLastStep } = navResult;

        await ticket.update({ chatbotMessageLastStep: newLastStep });

        if (targetNode.hasSubOptions && targetNode.chatbotOptions && targetNode.chatbotOptions.length > 0)
          await this.sendMessage(contact, targetNode, whatsapp, ticket);

        console.log(`[ChatbotResponseHelper] Navegación completada a: ${navResult.targetNode.identifier}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Valida y selecciona la opción elegida por el usuario
   */
  private async validateAndSelectOption(
    chatbotMessageReplied: ChatbotMessage,
    selectedOptionId: string | undefined,
    userMessage: string
  ): Promise<ChatbotMessage | null> {
    let chooseOption: ChatbotMessage | undefined;

    if (selectedOptionId) {
      console.log(`[ChatbotResponseHelper] Buscando opción por ID: ${selectedOptionId}`);
      chooseOption = chatbotMessageReplied.chatbotOptions?.find(co => co.id.toString() === selectedOptionId);
    } else {
      console.log(`[ChatbotResponseHelper] Mensaje de texto libre recibido, no se busca coincidencia por label`);
    }

    if (!chooseOption) {
      console.log(`[ChatbotResponseHelper] No se encontró opción para la respuesta: "${userMessage}"`);
    }

    return chooseOption || null;
  }

  /**
   * Guarda categoría/subcategoría seleccionada
   */
  private async saveCategory(
    ticket: Ticket,
    chooseOption: ChatbotMessage,
    chatbotMessageReplied: ChatbotMessage
  ): Promise<void> {
    // Categoría (nivel 1)
    if (ticket.chatbotMessageIdentifier === chatbotMessageReplied.identifier && !ticket.chatbotSelectedCategory) {
      let categoryText = chooseOption.title.trim();
      if (categoryText.includes(':')) {
        categoryText = categoryText.split(':')[0].trim();
      }
      if (categoryText.length > 30) {
        categoryText = categoryText.substring(0, 30) + '...';
      }

      await ticket.update({ chatbotSelectedCategory: categoryText });
      console.log(`[ChatbotResponseHelper] Categoría guardada: ${categoryText}`);
    }
    // Subcategoría (nivel 2)
    else if (ticket.chatbotMessageIdentifier !== chatbotMessageReplied.identifier) {
      const parentMessage = await ChatbotMessage.findOne({
        where: { id: chatbotMessageReplied.fatherChatbotOptionId }
      });

      if (parentMessage && parentMessage.identifier === ticket.chatbotMessageIdentifier) {
        let subcategoryText = chooseOption.title.trim();
        if (subcategoryText.includes(':')) {
          subcategoryText = subcategoryText.split(':')[0].trim();
        }
        if (subcategoryText.length > 30) {
          subcategoryText = subcategoryText.substring(0, 30) + '...';
        }

        await ticket.update({ chatbotSelectedSubcategory: subcategoryText });
        console.log(`[ChatbotResponseHelper] Subcategoría guardada: ${subcategoryText}`);
      }
    }
  }

  /**
   * Envía mensaje de error con lista reenviada
   */
  private async sendErrorMessage(
    chatbotMessageReplied: ChatbotMessage,
    ticket: Ticket,
    contact: Contact,
    whatsapp: Whatsapp
  ): Promise<void> {

    const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });
    const errorBodyText = `❌ Lo siento, no entendí tu respuesta.\n\nPor favor, selecciona una de las siguientes opciones:`;

    const rows = this.formatInteractiveListRows(chatbotMessageReplied.chatbotOptions || []);
    const rowsWithNav = await appendNavigationRows(
      rows,
      chatbotMessageReplied,
      ticket.chatbotMessageLastStep,
      ticket.chatbotMessageIdentifier
    );
    const rowsForMeta = rowsWithNav.map(({ label, ...row }) => row);

    const errorResponse = await client.sendInteractiveList({
      to: contact.number,
      bodyText: errorBodyText,
      buttonText: "Ver opciones",
      sections: [{ rows: rowsForMeta }]
    });

    const errorMessageId = errorResponse.messages[0].id;
    const errorOptionsText = this.formatInteractiveListOptionsAsText(rowsWithNav);

    const errorMessage = await this.saveMessageInDB(
      errorMessageId,
      ticket,
      contact,
      `${errorBodyText}${errorOptionsText}`,
      "chat",
      chatbotMessageReplied.identifier
    );

    this.emitSocketEvent(errorMessage, ticket, contact);

    console.log(`[ChatbotResponseHelper] Mensaje de error enviado para ticket ${ticket.id}`);
  }

  /**
   * Envía mensaje (lista interactiva, imagen o texto)
   */
  private async sendMessage(
    contact: Contact,
    chatbotMessage: ChatbotMessage,
    whatsapp: Whatsapp,
    ticket: Ticket
  ): Promise<void> {
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    let messageId: string;
    let messageBody: string;

    if (chatbotMessage.hasSubOptions && chatbotMessage.chatbotOptions && chatbotMessage.chatbotOptions.length > 0) {
      const rows = this.formatInteractiveListRows(chatbotMessage.chatbotOptions);
      const rowsWithNav = await appendNavigationRows(
        rows,
        chatbotMessage,
        chatbotMessage.identifier,
        ticket.chatbotMessageIdentifier
      );
      const rowsForMeta = rowsWithNav.map(({ label, ...row }) => row);

      const response = await client.sendInteractiveList({
        to: contact.number,
        bodyText: `\u200e${chatbotMessage.value}`,
        buttonText: "Ver opciones",
        sections: [{ rows: rowsForMeta }]
      });

      messageId = response.messages[0].id;
      const optionsText = this.formatInteractiveListOptionsAsText(rowsWithNav);
      messageBody = `\u200e${chatbotMessage.value}${optionsText}`;
    } else if (chatbotMessage.mediaType === "image" && chatbotMessage.mediaUrl) {
      messageBody = `\u200e${chatbotMessage.value}`;

      const uploadResult = await client.uploadMedia(
        chatbotMessage.mediaUrl,
        "image/jpeg"
      );

      const response = await client.sendImage({
        to: contact.number,
        mediaId: uploadResult.id,
        caption: messageBody
      });

      messageId = response.messages[0].id;
    } else {
      messageBody = `\u200e${chatbotMessage.value}`;

      const response = await client.sendText({
        to: contact.number,
        body: messageBody
      });

      messageId = response.messages[0].id;
    }

    // Guardar mensaje en BD
    const botMessage = await this.saveMessageInDB(
      messageId,
      ticket,
      contact,
      messageBody,
      chatbotMessage.mediaType || "chat",
      chatbotMessage.identifier
    );

    // Emitir evento socket
    this.emitSocketEvent(botMessage, ticket, contact);

    console.log(`[ChatbotResponseHelper] Mensaje enviado con ID: ${messageId}`);
  }

  /**
   * Guarda mensaje en la base de datos
   */
  private async saveMessageInDB(
    messageId: string,
    ticket: Ticket,
    contact: Contact,
    body: string,
    mediaType: string,
    identifier: string
  ): Promise<Message> {
    return await Message.create({
      id: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: body,
      fromMe: true,
      mediaType: mediaType,
      mediaUrl: null,
      read: true,
      quotedMsgId: null,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 3,
      identifier: identifier
    });
  }

  /**
   * Emite evento socket para mostrar mensaje en frontend
   */
  private emitSocketEvent(message: Message, ticket: Ticket, contact: Contact): void {
    emitEvent({
      to: [ticket.id.toString(), ticket.status],
      event: {
        name: "appMessage",
        data: {
          action: "create",
          message: message,
          ticket: ticket,
          contact: contact
        }
      }
    });
  }

  /**
   * Actualiza ticket después de procesar respuesta
   */
  private async   updateTicketAfterResponse(
    ticket: Ticket,
    nextChatbotMessage: ChatbotMessage,
    contact: Contact,
    whatsapp: Whatsapp
  ): Promise<void> {
    if (!nextChatbotMessage.hasSubOptions || !nextChatbotMessage.chatbotOptions || nextChatbotMessage.chatbotOptions.length === 0) {
      console.log(`[ChatbotResponseHelper] Bot terminó (sin más opciones), finalizando`);

      // PUNTO 3: Si hay pathJson, mostrar confirmación de incidencia en vez de finalizar
      if (ticket.incidenciaPathJson) {
        console.log(`[ChatbotResponseHelper] Detectado pathJson de incidencia, mostrando confirmación`);
        await this.sendIncidenciaConfirmation(ticket, nextChatbotMessage, contact, whatsapp);
        return;
      }

      await ticket.update({ chatbotMessageLastStep: null, chatbotFinishedAt: new Date(), lastBotMessageAt: new Date()});
    } else {
      await ticket.update({ chatbotMessageLastStep: nextChatbotMessage.identifier, lastBotMessageAt: new Date() });
    }
  }

  /**
   * Formatea filas para lista interactiva
   */
  private formatInteractiveListRows(options: ChatbotMessage[]): InteractiveListRow[] {
    return options.map(option => {
      const fullText = option.title.trim();

      if (fullText.includes(':')) {
        const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());
        return {
          id: option.id.toString(),
          title: beforeColon.substring(0, 24),
          description: afterColon ? afterColon.substring(0, 72) : undefined,
          label: option.label
        };
      }

      if (fullText.length <= 24) {
        return { id: option.id.toString(), title: fullText, label: option.label };
      }

      return {
        id: option.id.toString(),
        title: fullText.substring(0, 24),
        description: fullText.substring(24, 96),
        label: option.label
      };
    });
  }

  /**
   * Formatea opciones de lista como texto
   */
  private formatInteractiveListOptionsAsText(rows: InteractiveListRow[]): string {
    if (!rows || rows.length === 0) return "";

    const optionsText = rows.map((row) => {
      const prefix = row.label || row.id;
      if (row.description) {
        return `${prefix}. ${row.title}: ${row.description}`;
      }
      return `${prefix}. ${row.title}`;
    }).join("\n");

    return `\n\n${optionsText}`;
  }

  /**
   * Maneja confirmación de incidencia
   * Intercepta respuestas a los botones de confirmación
   */
  private async handleIncidenciaConfirmation(
    ticket: Ticket,
    selectedOptionId: string | undefined,
    chatbotMessageReplied: ChatbotMessage,
    whatsapp: Whatsapp,
    contact: Contact
  ): Promise<boolean> {
    if (!selectedOptionId) return false;

    if (selectedOptionId === INCIDENCIA_CANCEL_ID) {
      console.log(`[ChatbotResponseHelper] Usuario canceló incidencia, limpiando pathJson`);

      // Limpiar completamente pathJson de incidencia
      await ticket.update({ incidenciaPathJson: null });

      // Navegar back (similar a handleNavigation)
      const navResult = await resolveNavigationTarget(
        "back",
        ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier,
        ticket.chatbotMessageIdentifier
      );

      if (navResult) {
        await ticket.update({ chatbotMessageLastStep: navResult.newLastStep });

        if (navResult.targetNode.hasSubOptions && navResult.targetNode.chatbotOptions && navResult.targetNode.chatbotOptions.length > 0) {
          await this.sendMessage(contact, navResult.targetNode, whatsapp, ticket);
        }
      }

      return true;
    }

    if (selectedOptionId === INCIDENCIA_CONFIRM_ID) {
      console.log(`[ChatbotResponseHelper] Usuario confirmó incidencia, llamando CreateIncidenciaService`);

      const result = await CreateIncidenciaService({ ticket, contact, whatsapp });

      const client = new MetaApiClient({ phoneNumberId: whatsapp.phoneNumberId, accessToken: whatsapp.metaAccessToken });

      if (result.success && result.incidenciaId) {
        const message = `✅ Tu solicitud fue registrada con el número de incidencia *${result.incidenciaId}*.\n\nUn asesor se comunicará contigo al número desde el cual estás escribiendo lo más pronto posible.`;

        const response = await client.sendText({ to: contact.number, body: message });

        const messageId = response.messages[0].id;
        const botMessage = await this.saveMessageInDB(
          messageId,
          ticket,
          contact,
          message,
          "chat",
          chatbotMessageReplied.identifier
        );

        this.emitSocketEvent(botMessage, ticket, contact);

        // Finalizar bot
        await ticket.update({ chatbotMessageLastStep: null, chatbotFinishedAt: new Date(), lastBotMessageAt: new Date()});
      } else {
        const errorMessage = `Lo sentimos, no fue posible registrar tu incidencia${result.error ? ": " + result.error : ""} por este medio. Nuestras más sinceras disculpas por el inconveniente.\n\nUn asesor te atenderá lo más pronto posible para ayudarte con tu solicitud. 💙`;

        const response = await client.sendText({ to: contact.number, body: errorMessage });

        const messageId = response.messages[0].id;
        const botMessage = await this.saveMessageInDB(
          messageId,
          ticket,
          contact,
          errorMessage,
          "chat",
          chatbotMessageReplied.identifier
        );

        this.emitSocketEvent(botMessage, ticket, contact);

        // Finalizar bot
        await ticket.update({ chatbotMessageLastStep: null, chatbotFinishedAt: new Date(), lastBotMessageAt: new Date()});
      }

      return true;
    }

    return false;
  }

  /**
   *  Maneja el flujo de incidencias
   * Inicia o acumula el pathJson según corresponda
   */
  private async handleIncidenciaFlow(
    ticket: Ticket,
    chooseOption: ChatbotMessage,
    chatbotMessageReplied: ChatbotMessage
  ): Promise<void> {
    try {
      // Verificar si el nodo seleccionado tiene flujoConIncidencia activado
      if (!chooseOption.flujoConIncidencia) {
        console.log(`[ChatbotResponseHelper] Nodo seleccionado (${chooseOption.id}) no tiene flujo de incidencia`);
        return;
      }

      // Si pathJson no existe, iniciarlo
      if (!ticket.incidenciaPathJson) {
        console.log(`[ChatbotResponseHelper] Iniciando pathJson de incidencia con nodo ${chooseOption.id}`);
        const path = buildIncidenciaPath(null, chooseOption);
        await ticket.update({ incidenciaPathJson: JSON.stringify(path) });
      } else {
        // Si pathJson existe, acumular nodo actual
        console.log(`[ChatbotResponseHelper] Acumulando nodo ${chooseOption.id} en pathJson de incidencia`);
        const path = buildIncidenciaPath(ticket.incidenciaPathJson, chooseOption);
        await ticket.update({ incidenciaPathJson: JSON.stringify(path) });
      }
    } catch (error) {
      console.error(`[ChatbotResponseHelper] Error en handleIncidenciaFlow:`, error);
      Sentry.captureException(error);
    }
  }

  /**
   * Envía lista de confirmación de incidencia
   */
  private async sendIncidenciaConfirmation(
    ticket: Ticket,
    chatbotMessageReplied: ChatbotMessage,
    contact: Contact,
    whatsapp: Whatsapp
  ): Promise<void> {
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    const message = `Vamos a registrar una incidencia.\n\n¿Confirmas el registro?`;

    const response = await client.sendInteractiveList({
      to: contact.number,
      bodyText: message,
      buttonText: "Opciones",
      sections: [{
        rows: INCIDENCIA_CONFIRMATION_OPTIONS
      }]
    });

    const messageId = response.messages[0].id;
    const optionsText = INCIDENCIA_CONFIRMATION_OPTIONS.map(opt => opt.title).join("\n");
    const botMessage = await this.saveMessageInDB(
      messageId,
      ticket,
      contact,
      `${message}\n\n${optionsText}`,
      "chat",
      chatbotMessageReplied.identifier
    );

    this.emitSocketEvent(botMessage, ticket, contact);
  }
}

export default new ChatbotResponseHelper();
