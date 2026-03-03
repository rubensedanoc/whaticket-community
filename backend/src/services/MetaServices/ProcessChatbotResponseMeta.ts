import * as Sentry from "@sentry/node";
import ChatbotMessage from "../../models/ChatbotMessage";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MetaApiClient } from "../../clients/MetaApiClient";

interface ProcessChatbotResponseMetaParams {
  ticket: Ticket;
  userMessage: string;
  contact: Contact;
  whatsapp: Whatsapp;
}

const ProcessChatbotResponseMeta = async ({
  ticket,
  userMessage,
  contact,
  whatsapp
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
        chatbotMessageLastStep: null
      });
      return;
    }

    // Buscar la opción elegida por el usuario (replica wbotMessageListener.ts:949-951)
    const chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
      userMessage.toLowerCase().includes(co.label.toLowerCase())
    );

    if (!chooseOption) {
      console.log(`[ProcessChatbotResponseMeta] No se encontró opción para la respuesta: "${userMessage}"`);
      // TODO: Enviar mensaje de error y repetir opciones
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

    // Formatear mensaje (replica wbotMessageListener.ts:971-987)
    let message = `\u200e${nextChatbotMessage.value}`;

    if (nextChatbotMessage.hasSubOptions && nextChatbotMessage.chatbotOptions && nextChatbotMessage.chatbotOptions.length > 0) {
      message += "\n\n";
      nextChatbotMessage.chatbotOptions.forEach((chatbotOption, index) => {
        message += `*${chatbotOption.label}* - *${chatbotOption.title.trim()}*`;
        if (index < nextChatbotMessage.chatbotOptions.length - 1) {
          message += "\n\n";
        }
      });
    }

    console.log(`[ProcessChatbotResponseMeta] Mensaje formateado (${message.length} caracteres)`);

    // Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    // Enviar mensaje (replica wbotMessageListener.ts:996-1044)
    if (nextChatbotMessage.mediaType === "image" && nextChatbotMessage.mediaUrl) {
      console.log(`[ProcessChatbotResponseMeta] Enviando imagen con caption`);
      
      const uploadResult = await client.uploadMedia(
        nextChatbotMessage.mediaUrl,
        "image/jpeg"
      );

      await client.sendImage({
        to: contact.number,
        mediaId: uploadResult.id,
        caption: message
      });
    } else {
      console.log(`[ProcessChatbotResponseMeta] Enviando mensaje de texto`);
      
      await client.sendText({
        to: contact.number,
        body: message
      });
    }

    // Guardar mensaje en BD
    await Message.create({
      ticketId: ticket.id,
      contactId: contact.id,
      body: message,
      fromMe: true,
      mediaType: nextChatbotMessage.mediaType || "chat",
      mediaUrl: nextChatbotMessage.mediaUrl || null,
      read: true,
      quotedMsgId: null,
      ack: 3,
      identifier: nextChatbotMessage.identifier
    });

    // Actualizar ticket (replica wbotMessageListener.ts:1046-1048)
    await ticket.update({
      chatbotMessageLastStep: nextChatbotMessage.identifier
    });

    console.log(`[ProcessChatbotResponseMeta] Respuesta del chatbot enviada exitosamente para ticket ${ticket.id}`);

  } catch (error) {
    console.error(`[ProcessChatbotResponseMeta] Error procesando respuesta del chatbot:`, error);
    Sentry.captureException(error);
    throw error;
  }
};

export default ProcessChatbotResponseMeta;
