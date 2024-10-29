import WAWebJS, { MessageMedia } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import ChatbotMessage from "../../models/ChatbotMessage";
import Whatsapp from "../../models/Whatsapp";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import {
  verifyContact,
  verifyMediaMessage,
  verifyMessage
} from "./wbotMessageListener";

const formatChatbotMessage = (
  chatbotMessage: ChatbotMessage,
  messageVariables: { [key: string]: string }
) => {
  let message = chatbotMessage.value.replace(
    /{{\s*(\w+)\s*}}/g,
    (match, key) => messageVariables[key] || match
  );
  message = `\u200e${message}`;

  if (chatbotMessage.hasSubOptions) {
    message += "\n\n";
    chatbotMessage.chatbotOptions.forEach((option, index) => {
      message += `*${option.label}* - *${option.title.trim()}* ${
        index < chatbotMessage.chatbotOptions.length - 1 ? "\n\n" : ""
      }`;
    });
  }
  return message;
};

const SendApiChatbotMessage = async ({
  botNumber,
  toNumbers,
  messageVariables,
  chatbotMessageIdentifier,
  localbi_id
}: {
  botNumber: string;
  toNumbers: string[];
  messageVariables: { [key: string]: string };
  chatbotMessageIdentifier: string;
  localbi_id: string;
}) => {
  const result = { ok: true, messages: [], errors: [] };

  try {
    if (!botNumber || !toNumbers || !chatbotMessageIdentifier) {
      throw new AppError("ERR_INVALID_PARAMS");
    }

    const wpp = await Whatsapp.findOne({ where: { number: botNumber } });
    if (!wpp) throw new AppError("ERR_WAPP_NOT_FOUND");

    const wbot = getWbot(wpp.id);
    const chatbotMessage = await ChatbotMessage.findOne({
      where: {
        identifier: chatbotMessageIdentifier,
        isActive: true,
        wasDeleted: false
      },
      include: [
        {
          model: ChatbotMessage,
          as: "chatbotOptions",
          order: [["order", "ASC"]],
          separate: true,
          where: { wasDeleted: false }
        }
      ]
    });
    if (!chatbotMessage) throw new AppError("ERR_CHATBOT_MESSAGE_NOT_FOUND");

    const media =
      chatbotMessage.mediaType === "image"
        ? await MessageMedia.fromUrl(chatbotMessage.mediaUrl)
        : null;

    for (const toNumber of toNumbers) {
      try {
        let chatbotMessageValue = formatChatbotMessage(
          chatbotMessage,
          messageVariables
        );

        let msg: WAWebJS.Message;

        if (media) {
          msg = await wbot.sendMessage(`${toNumber}@c.us`, media, {
            caption: chatbotMessageValue
          });
        } else {
          msg = await wbot.sendMessage(`${toNumber}@c.us`, chatbotMessageValue);
        }

        const msgContact = await wbot.getContactById(msg.to);
        const contact = await verifyContact(msgContact);

        const ticket = await FindOrCreateTicketService({
          contact,
          whatsappId: wpp.id,
          unreadMessages: 0,
          groupContact: null,
          lastMessageTimestamp: msg.timestamp,
          chatbotMessageIdentifier: chatbotMessage.identifier
        });

        ticket.update({
          privateNote: localbi_id
        });

        if (media) {
          await verifyMediaMessage(
            msg,
            ticket,
            contact,
            true,
            chatbotMessage.identifier
          );
        } else {
          await verifyMessage({
            msg,
            ticket,
            contact,
            identifier: chatbotMessage.identifier
          });
        }

        result.messages.push("Mensaje enviado a " + toNumber);
      } catch (error) {
        console.log("--- Error en SendApiChatbotMessage", error);

        result.errors.push("Fallo enviar el mensaje a " + toNumber);
        result.errors.push(error);
      }
      await new Promise(resolve => setTimeout(resolve, 1500)); // Evitar bloqueos de WhatsApp
    }
  } catch (err) {
    result.ok = false;
    result.errors.push(err);
  }

  return result;
};

export default SendApiChatbotMessage;
