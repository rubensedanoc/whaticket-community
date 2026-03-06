import * as Sentry from "@sentry/node";
import ChatbotMessage from "../../models/ChatbotMessage";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { emitEvent } from "../../libs/emitEvent";

interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
  label?: string;
}

const formatInteractiveListOptionsAsText = (rows: InteractiveListRow[]): string => {
  if (!rows || rows.length === 0) return "";
  
  const optionsText = rows.map((row) => {
    const prefix = row.label || row.id;
    if (row.description) {
      return `${prefix}. ${row.title}: ${row.description}`;
    }
    return `${prefix}. ${row.title}`;
  }).join("\n");
  
  return `\n\n${optionsText}`;
};

interface ProcessChatbotResponseMetaParams {
  ticket: Ticket;
  userMessage: string;
  contact: Contact;
  whatsapp: Whatsapp;
  selectedOptionId?: string;
}

const ProcessChatbotResponseMeta = async ({
  ticket,
  userMessage,
  contact,
  whatsapp,
  selectedOptionId
}: ProcessChatbotResponseMetaParams): Promise<void> => {
  try {
    console.log(`[ProcessChatbotResponseMeta] Procesando respuesta para ticket ${ticket.id}: "${userMessage}"`);

    if (!ticket.chatbotMessageIdentifier) {
      console.log("[ProcessChatbotResponseMeta] Ticket no está en modo chatbot, ignorando");
      return;
    }

    // Buscar el mensaje actual del chatbot (replica wbotMessageListener.ts:929-943)
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
      console.error(`[ProcessChatbotResponseMeta] No se encontró mensaje del chatbot con identifier: ${ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier}`);
      return;
    }

    console.log(`[ProcessChatbotResponseMeta] Mensaje actual del chatbot: ${chatbotMessageReplied.identifier}, opciones: ${chatbotMessageReplied.chatbotOptions?.length || 0}`);

    if (!chatbotMessageReplied.chatbotOptions || chatbotMessageReplied.chatbotOptions.length === 0) {
      console.log("[ProcessChatbotResponseMeta] No hay opciones disponibles, finalizando chatbot");
      await ticket.update({
        chatbotMessageIdentifier: null,
        chatbotMessageLastStep: null,
        chatbotFinishedAt: new Date()
      });
      return;
    }

    // Buscar la opción elegida por el usuario
    let chooseOption;

    if (selectedOptionId) {
      // Si viene de un mensaje interactivo, buscar por ID exacto
      console.log(`[ProcessChatbotResponseMeta] Buscando opción por ID: ${selectedOptionId}`);
      chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
        co.id.toString() === selectedOptionId
      );
    } else {
      // Si es mensaje de texto (legacy), normalizar y buscar
      const normalizedUserMessage = userMessage.trim().toUpperCase();

      // Primero intentar coincidencia exacta, luego includes
      chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
        normalizedUserMessage === co.label.toUpperCase()
      );

      // Si no hay coincidencia exacta, buscar si el mensaje incluye la letra
      if (!chooseOption) {
        chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
          normalizedUserMessage.includes(co.label.toUpperCase())
        );
      }
    }

    if (!chooseOption) {
      console.log(`[ProcessChatbotResponseMeta] No se encontró opción para la respuesta: "${userMessage}"`);

      // Enviar mensaje de error con lista interactiva
      const client = new MetaApiClient({
        phoneNumberId: whatsapp.phoneNumberId,
        accessToken: whatsapp.metaAccessToken
      });

      const errorBodyText = `❌ Lo siento, no entendí tu respuesta.\n\nPor favor, selecciona una de las siguientes opciones:`;

      const rows = chatbotMessageReplied.chatbotOptions.map(option => {
        const fullText = option.title.trim();
        
        // Detectar si hay dos puntos para separar título y descripción
        if (fullText.includes(':')) {
          const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());
          
          return {
            id: option.id.toString(),
            title: beforeColon.substring(0, 24),
            description: afterColon ? afterColon.substring(0, 72) : undefined,
            label: option.label
          };
        }
        
        // Si no hay dos puntos y el texto es corto, solo título
        if (fullText.length <= 24) {
          return {
            id: option.id.toString(),
            title: fullText,
            label: option.label
          };
        }
        
        // Si es largo sin dos puntos, cortar en 24 y poner el resto en descripción
        return {
          id: option.id.toString(),
          title: fullText.substring(0, 24),
          description: fullText.substring(24, 96),
          label: option.label
        };
      });

      // Crear rows sin el campo label para enviar a Meta API
      const rowsForMeta = rows.map(({ label, ...row }) => row);

      const errorResponse = await client.sendInteractiveList({
        to: contact.number,
        bodyText: errorBodyText,
        buttonText: "Ver opciones",
        sections: [
          {
            rows: rowsForMeta
          }
        ]
      });

      const errorMessageId = errorResponse.messages[0].id;

      // Guardar mensaje de error en BD
      const errorOptionsText = formatInteractiveListOptionsAsText(rows);
      const errorMessage = await Message.create({
        id: errorMessageId,
        ticketId: ticket.id,
        contactId: contact.id,
        body: `${errorBodyText}${errorOptionsText}`,
        fromMe: true,
        mediaType: "chat",
        read: true,
        quotedMsgId: null,
        timestamp: Math.floor(Date.now() / 1000),
        ack: 3,
        identifier: chatbotMessageReplied.identifier
      });

      // Emitir evento socket para mostrar mensaje en frontend
      emitEvent({
        to: [ticket.id.toString(), ticket.status],
        event: {
          name: "appMessage",
          data: {
            action: "create",
            message: errorMessage,
            ticket: ticket,
            contact: contact
          }
        }
      });

      console.log(`[ProcessChatbotResponseMeta] Mensaje de error con lista interactiva enviado, esperando respuesta válida`);
      return;
    }

    console.log(`[ProcessChatbotResponseMeta] Opción seleccionada: ${chooseOption.label} - ${chooseOption.title}`);

    // Cargar el siguiente mensaje del chatbot (replica wbotMessageListener.ts:956-969)
    const nextChatbotMessage = await ChatbotMessage.findOne({
      where: {
        id: chooseOption.id
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

    if (!nextChatbotMessage) {
      console.error(`[ProcessChatbotResponseMeta] No se encontró el siguiente mensaje del chatbot con id: ${chooseOption.id}`);
      return;
    }

    console.log(`[ProcessChatbotResponseMeta] Siguiente mensaje: ${nextChatbotMessage.identifier}, hasSubOptions: ${nextChatbotMessage.hasSubOptions}`);

    // Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    // Enviar mensaje
    let messageId: string;
    let message: string;

    if (nextChatbotMessage.hasSubOptions && nextChatbotMessage.chatbotOptions && nextChatbotMessage.chatbotOptions.length > 0) {
      console.log(`[ProcessChatbotResponseMeta] Enviando lista interactiva con ${nextChatbotMessage.chatbotOptions.length} opciones`);

      const rows = nextChatbotMessage.chatbotOptions.map(option => {
        const fullText = option.title.trim();
        
        // Detectar si hay dos puntos para separar título y descripción
        if (fullText.includes(':')) {
          const [beforeColon, afterColon] = fullText.split(':').map(s => s.trim());
          
          return {
            id: option.id.toString(),
            title: beforeColon.substring(0, 24),
            description: afterColon ? afterColon.substring(0, 72) : undefined,
            label: option.label
          };
        }
        
        // Si no hay dos puntos y el texto es corto, solo título
        if (fullText.length <= 24) {
          return {
            id: option.id.toString(),
            title: fullText,
            label: option.label
          };
        }
        
        // Si es largo sin dos puntos, cortar en 24 y poner el resto en descripción
        return {
          id: option.id.toString(),
          title: fullText.substring(0, 24),
          description: fullText.substring(24, 96),
          label: option.label
        };
      });

      // Crear rows sin el campo label para enviar a Meta API
      const rowsForMeta = rows.map(({ label, ...row }) => row);

      const response = await client.sendInteractiveList({
        to: contact.number,
        bodyText: `\u200e${nextChatbotMessage.value}`,
        buttonText: "Ver opciones",
        sections: [
          {
            rows: rowsForMeta
          }
        ]
      });

      messageId = response.messages[0].id;
      const optionsText = formatInteractiveListOptionsAsText(rows);
      message = `\u200e${nextChatbotMessage.value}${optionsText}`;
    } else if (nextChatbotMessage.mediaType === "image" && nextChatbotMessage.mediaUrl) {
      console.log(`[ProcessChatbotResponseMeta] Enviando imagen con caption`);

      message = `\u200e${nextChatbotMessage.value}`;

      const uploadResult = await client.uploadMedia(
        nextChatbotMessage.mediaUrl,
        "image/jpeg"
      );

      const response = await client.sendImage({
        to: contact.number,
        mediaId: uploadResult.id,
        caption: message
      });

      messageId = response.messages[0].id;
    } else {
      console.log(`[ProcessChatbotResponseMeta] Enviando mensaje de texto`);

      message = `\u200e${nextChatbotMessage.value}`;

      const response = await client.sendText({
        to: contact.number,
        body: message
      });

      messageId = response.messages[0].id;
    }

    console.log(`[ProcessChatbotResponseMeta] Mensaje enviado con ID: ${messageId}`);

    // Guardar mensaje en BD
    const botMessage = await Message.create({
      id: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: message,
      fromMe: true,
      mediaType: nextChatbotMessage.mediaType || "chat",
      mediaUrl: nextChatbotMessage.mediaUrl || null,
      read: true,
      quotedMsgId: null,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 3,
      identifier: nextChatbotMessage.identifier
    });

    // Emitir evento socket para mostrar mensaje en frontend
    emitEvent({
      to: [ticket.id.toString(), ticket.status],
      event: {
        name: "appMessage",
        data: {
          action: "create",
          message: botMessage,
          ticket: ticket,
          contact: contact
        }
      }
    });

    // Actualizar ticket (replica wbotMessageListener.ts:1046-1048)
    // Si el mensaje NO tiene más opciones, el bot terminó
    if (!nextChatbotMessage.hasSubOptions || !nextChatbotMessage.chatbotOptions || nextChatbotMessage.chatbotOptions.length === 0) {
      console.log(`[ProcessChatbotResponseMeta] Bot terminó (sin más opciones), limpiando chatbot y guardando chatbotFinishedAt`);
      await ticket.update({
        chatbotMessageIdentifier: null,
        chatbotMessageLastStep: null,
        chatbotFinishedAt: new Date()
      });
    } else {
      // Si tiene más opciones, actualizar el último paso
      await ticket.update({
        chatbotMessageLastStep: nextChatbotMessage.identifier
      });
    }

    console.log(`[ProcessChatbotResponseMeta] Respuesta del chatbot enviada exitosamente para ticket ${ticket.id}`);

  } catch (error) {
    console.error(`[ProcessChatbotResponseMeta] Error procesando respuesta del chatbot:`, error);
    Sentry.captureException(error);
    throw error;
  }
};

export default ProcessChatbotResponseMeta;
