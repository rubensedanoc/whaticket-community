import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { MetaApiSuccessResponse } from "../../types/meta/MetaApiTypes";
import { emitEvent } from "../../libs/emitEvent";
import getAndSetBeenWaitingSinceTimestampTicketService from "../TicketServices/getAndSetBeenWaitingSinceTimestampTicketService";
import * as path from "path";
import {
  ensureMulterFileLocalPath,
  persistMulterFile
} from "../StorageService";
import { sendGoogleChatMetaError } from "../../helpers/SendGoogleChatLog";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  whatsapp: Whatsapp;
  body?: string;
}

interface MetaMediaResult {
  id: string;
  fromMe: boolean;
  isMetaApi: true;
}

const SendWhatsAppMediaMeta = async ({
  media,
  ticket,
  whatsapp,
  body
}: Request): Promise<MetaMediaResult> => {
  try {
    const storedMediaKey = await persistMulterFile(media, "messages");
    const { localPath, cleanup } = await ensureMulterFileLocalPath(media);

    console.log("[SendWhatsAppMediaMeta] Iniciando envio de media");
    console.log("[SendWhatsAppMediaMeta] TicketId:", ticket.id);
    console.log("[SendWhatsAppMediaMeta] Filename:", storedMediaKey);
    console.log("[SendWhatsAppMediaMeta] Mimetype:", media.mimetype);
    console.log("[SendWhatsAppMediaMeta] Size:", media.size);

    // Validar tamaño (Meta API tiene límites según tipo)
    if (media.size > 100000000) {
      throw new AppError("Archivo supera el tamaño máximo permitido (100mb)");
    }

    // Validar credenciales
    if (!whatsapp || !whatsapp.phoneNumberId || !whatsapp.metaAccessToken) {
      throw new AppError("ERR_META_CREDENTIALS_NOT_CONFIGURED");
    }

    // Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    // Formatear caption si existe
    const caption = body ? formatBody(body, ticket.contact) : undefined;

    // Normalizar MIME type (Meta API no acepta audio/mp3, debe ser audio/mpeg)
    let normalizedMimetype = media.mimetype;
    if (media.mimetype === "audio/mp3") {
      normalizedMimetype = "audio/mpeg";
      console.log("[SendWhatsAppMediaMeta] MIME type normalizado: audio/mp3 -> audio/mpeg");
    }

    // Subir media a Meta
    console.log("[SendWhatsAppMediaMeta] Subiendo media a Meta...");
    const uploadResult = await client
      .uploadMedia(localPath, normalizedMimetype)
      .finally(async () => {
        await cleanup();
      });
    const mediaId = uploadResult.id;
    console.log("[SendWhatsAppMediaMeta] Media subida, ID:", mediaId);

    // Determinar tipo de media y enviar
    const mediaType = media.mimetype.split("/")[0]; // image, audio, video, application
    let result: MetaApiSuccessResponse;

    const toNumber = ticket.contact.number;
    const recipientType = ticket.isGroup ? "group" : undefined;

    if (mediaType === "image") {
      console.log("[SendWhatsAppMediaMeta] Enviando como imagen");
      result = await client.sendImage({
        to: toNumber,
        mediaId,
        caption,
        recipientType
      });
    } else if (mediaType === "audio") {
      console.log("[SendWhatsAppMediaMeta] Enviando como audio");
      result = await client.sendAudio({
        to: toNumber,
        mediaId,
        recipientType
      });
    } else {
      // document (application/*, video/*, etc)
      console.log("[SendWhatsAppMediaMeta] Enviando como documento");
      const filename = media.originalname || path.basename(storedMediaKey);
      result = await client.sendDocument({
        to: toNumber,
        mediaId,
        filename,
        caption,
        recipientType
      });
    }

    const messageId = result.messages[0].id;
    console.log("[SendWhatsAppMediaMeta] Mensaje enviado, ID:", messageId);

    // Guardar mensaje en BD
    const newMessage = await Message.create({
      id: messageId,
      body: caption || storedMediaKey,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      fromMe: true,
      mediaType,
      mediaUrl: storedMediaKey,
      read: true,
      quotedMsgId: null,
      timestamp: Math.floor(Date.now() / 1000)
    });

    // Actualizar último mensaje del ticket
    await ticket.update({ lastMessage: body || storedMediaKey });

    console.log("[SendWhatsAppMediaMeta] Mensaje guardado en BD:", newMessage.id);

    // Recalcular beenWaitingSinceTimestamp: si el CS ya respondió debe quedar null
    const updatedTicket = await getAndSetBeenWaitingSinceTimestampTicketService(ticket) as Ticket;

    // Emitir evento socket para actualizar frontend
    emitEvent({
      to: [ticket.id.toString()],
      event: {
        name: "appMessage",
        data: {
          action: "create",
          message: newMessage,
          ticket: updatedTicket,
          contact: ticket.contact
        }
      }
    });

    return {
      id: messageId,
      fromMe: true,
      isMetaApi: true
    };

  } catch (err) {
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMediaMeta] ❌ ERROR CAPTURADO");
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMediaMeta] ERROR TicketId:", ticket.id);
    console.log("[SendWhatsAppMediaMeta] ERROR Filename:", media.originalname);
    console.log("[SendWhatsAppMediaMeta] ERROR Message:", err.message);
    console.log("[SendWhatsAppMediaMeta] ERROR Stack:", err.stack);

    Sentry.captureException(err);

    sendGoogleChatMetaError({
      service: "SendWhatsAppMediaMeta",
      error: "Error al enviar media",
      details: `${err?.message || err?.toString()} - Archivo: ${media.originalname}`,
      whatsappId: ticket.whatsappId,
      ticketId: ticket.id,
      contactNumber: ticket.contact.number
    });

    throw new AppError("ERR_SENDING_WAPP_MSG_META");
  }
};

export default SendWhatsAppMediaMeta;
