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
  appendNavigationRows,
  resolveNavigationTarget
} from "../../ChatbotMessageService/ChatbotNavigationHelper";

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

      // Si no hay opciones, finalizar bot
      if (!chatbotMessageReplied.chatbotOptions || chatbotMessageReplied.chatbotOptions.length === 0) {
        console.log("[ChatbotResponseHelper] No hay opciones disponibles, finalizando chatbot");
        await ticket.update({
          chatbotMessageLastStep: null,
          chatbotFinishedAt: new Date(),
          lastBotMessageAt: new Date()
        });
        return;
      }

      // Buscar opción seleccionada
      const chooseOption = await this.validateAndSelectOption(chatbotMessageReplied, selectedOptionId, userMessage);

      if (!chooseOption) {
        await this.sendErrorMessage(chatbotMessageReplied, ticket, contact, whatsapp);
        return;
      }

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
      await this.updateTicketAfterResponse(ticket, nextChatbotMessage);

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

      const client = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });

      const response = await client.sendText({
        to: contact.number,
        body: message
      });

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
      await ticket.update({
        chatbotMessageIdentifier: targetIdentifier,
        chatbotMessageLastStep: chatbotMessage.identifier,
        lastBotMessageAt: new Date()
      });

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

      const navResult = await resolveNavigationTarget(navAction, currentIdentifier, ticket.chatbotMessageIdentifier);

      if (navResult) {
        const { targetNode, newLastStep } = navResult;

        await ticket.update({ chatbotMessageLastStep: newLastStep });

        if (targetNode.hasSubOptions && targetNode.chatbotOptions && targetNode.chatbotOptions.length > 0) {
          await this.sendMessage(contact, targetNode, whatsapp, ticket);
        }

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
      chooseOption = chatbotMessageReplied.chatbotOptions?.find(co =>
        co.id.toString() === selectedOptionId
      );
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
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

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
  private async updateTicketAfterResponse(ticket: Ticket, nextChatbotMessage: ChatbotMessage): Promise<void> {
    if (!nextChatbotMessage.hasSubOptions || !nextChatbotMessage.chatbotOptions || nextChatbotMessage.chatbotOptions.length === 0) {
      console.log(`[ChatbotResponseHelper] Bot terminó (sin más opciones), finalizando`);
      await ticket.update({
        chatbotMessageLastStep: null,
        chatbotFinishedAt: new Date(),
        lastBotMessageAt: new Date()
      });
    } else {
      await ticket.update({
        chatbotMessageLastStep: nextChatbotMessage.identifier,
        lastBotMessageAt: new Date()
      });
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
}

export default new ChatbotResponseHelper();
