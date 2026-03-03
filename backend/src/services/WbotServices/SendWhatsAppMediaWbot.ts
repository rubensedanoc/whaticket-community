import * as Sentry from "@sentry/node";
import {
  MessageMedia,
  MessageSendOptions,
  Message as WbotMessage
} from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { emitEvent } from "../../libs/emitEvent";
import {
  ensureMulterFileLocalPath,
  persistMulterFile
} from "../StorageService";

import formatBody from "../../helpers/Mustache";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const SendWhatsAppMediaWbot = async ({
  media,
  ticket,
  body
}: Request): Promise<WbotMessage> => {
  if (media.size > 80000000) {
    throw new AppError("Archivo supera el tamaño máximo permitido (80mb)");
  }

  try {
    const storedMediaKey = await persistMulterFile(media, "messages");
    const { localPath, cleanup } = await ensureMulterFileLocalPath(media);

    const wbot = await GetTicketWbot(ticket);
    const hasBody = body
      ? formatBody(body as string, ticket.contact)
      : undefined;

    const newMedia = MessageMedia.fromFilePath(localPath);

    let mediaOptions: MessageSendOptions = {
      caption: hasBody,
      sendAudioAsVoice: true
    };

    if (
      newMedia.mimetype.startsWith("image/") &&
      !/^.*\.(jpe?g|png|gif)?$/i.exec(storedMediaKey)
    ) {
      mediaOptions["sendMediaAsDocument"] = true;
    }

    const sentMessage = await wbot
      .sendMessage(
        `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`,
        newMedia,
        mediaOptions
      )
      .finally(async () => {
        await cleanup();
      });

    await ticket.update({ lastMessage: body || storedMediaKey });

    // Crear el mensaje en la base de datos inmediatamente
    // IMPORTANTE: Usamos el ID de WhatsApp para evitar duplicados cuando llegue el evento message_create
    const messageData = {
      id: sentMessage.id.id, // ID único de WhatsApp - evita duplicados
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: hasBody || storedMediaKey,
      fromMe: true,
      mediaType: newMedia.mimetype.split("/")[0], // image, video, audio, etc
      mediaUrl: storedMediaKey,
      read: true,
      quotedMsgId: null,
      ack: sentMessage.ack || 0,
      remoteJid: sentMessage.to,
      participant: null,
      dataJson: JSON.stringify(sentMessage),
      timestamp: sentMessage.timestamp
    };

    try {
      const newMessage = await Message.create(messageData);

      // Emitir evento socket para actualizar la UI inmediatamente
      emitEvent({
        to: [ticket.id.toString()],
        event: {
          name: "appMessage",
          data: {
            action: "create",
            message: newMessage,
            ticket: ticket,
            contact: ticket.contact
          }
        }
      });
    } catch (error) {
      // Si el mensaje ya existe (clave primaria duplicada), ignorar el error
      // Esto puede pasar si el listener de WhatsApp lo procesó muy rápido
      console.log(`[SendWhatsAppMediaWbot] Mensaje ${sentMessage.id.id} ya existe en BD, ignorando duplicado`);
    }

    // fs.unlinkSync(media.path);

    return sentMessage;
  } catch (err) {
    console.log(err);
    Sentry.captureException(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMediaWbot;
