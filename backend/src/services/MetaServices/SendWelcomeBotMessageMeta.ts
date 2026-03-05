import * as Sentry from "@sentry/node";
import ChatbotMessage from "../../models/ChatbotMessage";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MetaApiClient } from "../../clients/MetaApiClient";

interface SendWelcomeBotMessageMetaParams {
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
}

const SendWelcomeBotMessageMeta = async ({
  ticket,
  contact,
  whatsapp
}: SendWelcomeBotMessageMetaParams): Promise<void> => {
  try {
    console.log(`[SendWelcomeBotMessageMeta] Iniciando para ticket ${ticket.id}`);

    const welcomeBot = await ChatbotMessage.findOne({
      where: {
        identifier: "soporte",
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

    if (!welcomeBot) {
      console.error("[SendWelcomeBotMessageMeta] No se encontró mensaje de bienvenida con identifier='soporte'");
      return;
    }

    console.log(`[SendWelcomeBotMessageMeta] Mensaje de bienvenida encontrado: ${welcomeBot.id}`);

    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    let messageId: string;
    let message: string;

    if (welcomeBot.hasSubOptions && welcomeBot.chatbotOptions && welcomeBot.chatbotOptions.length > 0) {
      console.log(`[SendWelcomeBotMessageMeta] Enviando lista interactiva con ${welcomeBot.chatbotOptions.length} opciones`);
      
      const rows = welcomeBot.chatbotOptions.map(option => ({
        id: option.label,
        title: option.title.trim().substring(0, 24),
        description: option.title.trim().length > 24 ? option.title.trim().substring(24, 96) : undefined
      }));

      const response = await client.sendInteractiveList({
        to: contact.number,
        bodyText: `\u200e${welcomeBot.value}`,
        buttonText: "Ver opciones",
        sections: [
          {
            rows: rows
          }
        ]
      });

      messageId = response.messages[0].id;
      message = `\u200e${welcomeBot.value}`;
    } else if (welcomeBot.mediaType === "image" && welcomeBot.mediaUrl) {
      console.log(`[SendWelcomeBotMessageMeta] Enviando imagen con caption`);
      
      message = `\u200e${welcomeBot.value}`;
      
      const uploadResult = await client.uploadMedia(
        welcomeBot.mediaUrl,
        "image/jpeg"
      );

      const response = await client.sendImage({
        to: contact.number,
        mediaId: uploadResult.id,
        caption: message
      });

      messageId = response.messages[0].id;
    } else {
      console.log(`[SendWelcomeBotMessageMeta] Enviando mensaje de texto`);
      
      message = `\u200e${welcomeBot.value}`;
      
      const response = await client.sendText({
        to: contact.number,
        body: message
      });

      messageId = response.messages[0].id;
    }

    console.log(`[SendWelcomeBotMessageMeta] Mensaje enviado con ID: ${messageId}`);

    await Message.create({
      id: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: message,
      fromMe: true,
      mediaType: welcomeBot.mediaType || "chat",
      mediaUrl: welcomeBot.mediaUrl || null,
      read: true,
      quotedMsgId: null,
      ack: 3,
      identifier: welcomeBot.identifier
    });

    await ticket.update({
      chatbotMessageIdentifier: welcomeBot.identifier
    });

    console.log(`[SendWelcomeBotMessageMeta] Bot de bienvenida enviado exitosamente para ticket ${ticket.id}`);

  } catch (error) {
    console.error(`[SendWelcomeBotMessageMeta] Error enviando bot de bienvenida:`, error);
    Sentry.captureException(error);
  }
};

export default SendWelcomeBotMessageMeta;
