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

    let message = `\u200e${welcomeBot.value}`;

    if (welcomeBot.hasSubOptions && welcomeBot.chatbotOptions && welcomeBot.chatbotOptions.length > 0) {
      message += "\n\n";
      welcomeBot.chatbotOptions.forEach((option, index) => {
        message += `*${option.label}* - *${option.title.trim()}*`;
        if (index < welcomeBot.chatbotOptions.length - 1) {
          message += "\n\n";
        }
      });
    }

    console.log(`[SendWelcomeBotMessageMeta] Mensaje formateado (${message.length} caracteres)`);

    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    if (welcomeBot.mediaType === "image" && welcomeBot.mediaUrl) {
      console.log(`[SendWelcomeBotMessageMeta] Enviando imagen con caption`);
      
      const uploadResult = await client.uploadMedia(
        welcomeBot.mediaUrl,
        "image/jpeg"
      );

      await client.sendImage({
        to: contact.number,
        mediaId: uploadResult.id,
        caption: message
      });
    } else {
      console.log(`[SendWelcomeBotMessageMeta] Enviando mensaje de texto`);
      
      await client.sendText({
        to: contact.number,
        body: message
      });
    }

    await Message.create({
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
