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
      
      const rows = welcomeBot.chatbotOptions.map(option => {
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
        bodyText: `\u200e${welcomeBot.value}`,
        buttonText: "Ver opciones",
        sections: [
          {
            rows: rowsForMeta
          }
        ]
      });

      messageId = response.messages[0].id;
      const optionsText = formatInteractiveListOptionsAsText(rows);
      message = `\u200e${welcomeBot.value}${optionsText}`;
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

    const botMessage = await Message.create({
      id: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: message,
      fromMe: true,
      mediaType: welcomeBot.mediaType || "chat",
      mediaUrl: welcomeBot.mediaUrl || null,
      read: true,
      quotedMsgId: null,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 3,
      identifier: welcomeBot.identifier
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
