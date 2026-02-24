import * as Sentry from "@sentry/node";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { emitEvent } from "../../libs/emitEvent";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { MetaWebhookMessage, MetaWebhookPayload } from "../../types/meta/MetaWebhookTypes";
import DownloadMetaMedia from "./DownloadMetaMedia";

interface HandleMetaWebhookMessageParams {
  payload: MetaWebhookPayload;
  whatsapp: Whatsapp;
}

/**
 * Procesa mensajes entrantes desde el webhook de Meta API
 * Replica el flujo de wbotMessageListener para Puppeteer
 */
const HandleMetaWebhookMessage = async ({
  payload,
  whatsapp
}: HandleMetaWebhookMessageParams): Promise<void> => {
  try {
    console.log("[HandleMetaWebhookMessage] Iniciando procesamiento");

    // Extraer datos del payload
    const entry = payload.entry[0];
    const change = entry.changes[0];
    const value = change.value;

    // Validar que hay mensajes
    if (!value.messages || value.messages.length === 0) {
      console.log("[HandleMetaWebhookMessage] No hay mensajes para procesar");
      return;
    }

    // Procesar cada mensaje (normalmente es uno solo)
    for (const message of value.messages) {
      await processMessage(message, value, whatsapp);
    }

  } catch (err) {
    console.error("[HandleMetaWebhookMessage] Error:", err);
    Sentry.captureException(err);
    // No lanzar error para no afectar el webhook
  }
};

/**
 * Procesa un mensaje individual
 */
const processMessage = async (
  message: MetaWebhookMessage,
  value: any,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    console.log("[HandleMetaWebhookMessage] Procesando mensaje:", message.id);
    console.log("[HandleMetaWebhookMessage] Tipo:", message.type);
    console.log("[HandleMetaWebhookMessage] From:", message.from);

    // Meta API usa el prefijo 120363 para identificar grupos de WhatsApp
    // Formato grupo: 120363XXXXXXXXXX@g.us
    // Formato individual: número de teléfono normal (ej: 5215512345678)
    const isGroup = message.from.startsWith('120363');
    console.log("[HandleMetaWebhookMessage] Es grupo:", isGroup);

    let contact: Contact;
    let groupContact: Contact | undefined;

    if (isGroup) {
      groupContact = await Contact.findOne({
        where: {
          number: message.from,
          isGroup: true
        }
      });

      if (!groupContact) {
        groupContact = await Contact.create({
          name: `Grupo ${message.from}`,
          number: message.from,
          isGroup: true,
          email: ""
        });
        console.log("[HandleMetaWebhookMessage] Grupo creado automáticamente:", groupContact.id);
      }

      const contactInfo = value.contacts?.find((c: any) => c.wa_id === message.from);
      const participantName = contactInfo?.profile?.name || "Participante";
      const participantNumber = contactInfo?.wa_id || message.from;

      contact = await CreateOrUpdateContactService({
        name: participantName,
        number: participantNumber,
        isGroup: false,
        email: "",
        profilePicUrl: ""
      });

      console.log("[HandleMetaWebhookMessage] Participante del grupo:", contact.id);
    } else {
      const contactInfo = value.contacts?.find((c: any) => c.wa_id === message.from);
      const contactName = contactInfo?.profile?.name || message.from;
      const contactNumber = message.from;

      console.log("[HandleMetaWebhookMessage] Contacto:", contactName, contactNumber);

      contact = await CreateOrUpdateContactService({
        name: contactName,
        number: contactNumber,
        isGroup: false,
        email: "",
        profilePicUrl: ""
      });

      console.log("[HandleMetaWebhookMessage] Contacto creado/actualizado:", contact.id);
    }

    const ticket = await FindOrCreateTicketService({
      contact,
      whatsappId: whatsapp.id,
      unreadMessages: 1,
      groupContact: isGroup ? groupContact : undefined,
      lastMessageTimestamp: parseInt(message.timestamp),
      msgFromMe: false,
      body: getMessageBody(message)
    });

    console.log("[HandleMetaWebhookMessage] Ticket:", ticket.id);

    // Guardar mensaje en BD
    const mediaType = getMediaType(message);

    // Descargar media si el mensaje tiene adjuntos
    let mediaUrl: string | null = null;
    let messageBody = getMessageBody(message);
    
    if (hasMedia(message)) {
      try {
        console.log("[HandleMetaWebhookMessage] Mensaje tiene media, descargando...");
        const mediaInfo = getMediaInfo(message);

        const downloadResult = await DownloadMetaMedia({
          mediaId: mediaInfo.id,
          accessToken: whatsapp.metaAccessToken,
          mimeType: mediaInfo.mimeType
        });

        mediaUrl = downloadResult.filename;
        
        // Si no hay caption, usar el filename como body (igual que Puppeteer)
        if (!hasCaption(message)) {
          messageBody = downloadResult.filename;
        }
        
        console.log("[HandleMetaWebhookMessage] Media descargado:", mediaUrl);
      } catch (err) {
        console.error("[HandleMetaWebhookMessage] Error descargando media:", err);
        // Continuar sin media si falla la descarga
      }
    }

    const newMessage = await Message.create({
      id: message.id, // wamid.xxx
      body: messageBody,
      ticketId: ticket.id,
      contactId: contact.id,
      fromMe: false,
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      read: false,
      quotedMsgId: message.context?.id || null,
      timestamp: parseInt(message.timestamp),
      ack: 0
    });

    console.log("[HandleMetaWebhookMessage] Mensaje guardado:", newMessage.id);

    // Actualizar último mensaje del ticket
    await ticket.update({
      lastMessage: messageBody,
      lastMessageAt: new Date(parseInt(message.timestamp) * 1000)
    });

    // Emitir evento socket para actualizar frontend
    emitEvent({
      to: [ticket.id.toString()],
      event: {
        name: "appMessage",
        data: {
          action: "create",
          message: newMessage,
          ticket: ticket,
          contact: contact
        }
      }
    });

    console.log("[HandleMetaWebhookMessage] Evento socket emitido");

    // Emitir evento de ticket para actualizar lista
    emitEvent({
      to: [ticket.id.toString()],
      event: {
        name: "ticket",
        data: {
          action: "update",
          ticket: ticket
        }
      }
    });

  } catch (err) {
    console.error("[HandleMetaWebhookMessage] Error procesando mensaje:", err);
    Sentry.captureException(err);
  }
};

/**
 * Extrae el cuerpo del mensaje según su tipo
 */
const getMessageBody = (message: MetaWebhookMessage): string => {
  switch (message.type) {
    case "text":
      return message.text?.body || "";
    case "image":
      return message.image?.caption || "Imagen";
    case "audio":
      return "🎵 Audio";
    case "video":
      return message.video?.caption || "Video";
    case "document":
      return message.document?.caption || message.document?.filename || "Documento";
    case "location":
      return "📍 Ubicación";
    case "sticker":
      return "Sticker";
    default:
      return `Mensaje tipo: ${message.type}`;
  }
};

/**
 * Determina el tipo de media del mensaje
 */
const getMediaType = (message: MetaWebhookMessage): string | null => {
  switch (message.type) {
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "document":
      return "application";
    default:
      return null;
  }
};

/**
 * Verifica si el mensaje tiene media adjunto
 */
const hasMedia = (message: MetaWebhookMessage): boolean => {
  return message.type === "image" ||
         message.type === "audio" ||
         message.type === "video" ||
         message.type === "document" ||
         message.type === "sticker";
};

/**
 * Verifica si el mensaje tiene caption
 */
const hasCaption = (message: MetaWebhookMessage): boolean => {
  if (message.type === "image" && message.image?.caption) return true;
  if (message.type === "video" && message.video?.caption) return true;
  if (message.type === "document" && message.document?.caption) return true;
  return false;
};

/**
 * Extrae información del media del mensaje
 */
const getMediaInfo = (message: MetaWebhookMessage): { id: string; mimeType: string } => {
  switch (message.type) {
    case "image":
      return {
        id: message.image!.id,
        mimeType: message.image!.mime_type
      };
    case "audio":
      return {
        id: message.audio!.id,
        mimeType: message.audio!.mime_type
      };
    case "video":
      return {
        id: message.video!.id,
        mimeType: message.video!.mime_type
      };
    case "document":
      return {
        id: message.document!.id,
        mimeType: message.document!.mime_type
      };
    case "sticker":
      return {
        id: message.sticker!.id,
        mimeType: message.sticker!.mime_type
      };
    default:
      throw new Error(`Tipo de mensaje no soportado para media: ${message.type}`);
  }
};

export default HandleMetaWebhookMessage;
