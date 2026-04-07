import * as Sentry from "@sentry/node";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { emitEvent } from "../../libs/emitEvent";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import getAndSetBeenWaitingSinceTimestampTicketService from "../TicketServices/getAndSetBeenWaitingSinceTimestampTicketService";
import { MetaWebhookMessage, MetaWebhookPayload } from "../../types/meta/MetaWebhookTypes";
import DownloadMetaMedia from "./DownloadMetaMedia";
import SendWelcomeBotMessageMeta from "./SendWelcomeBotMessageMeta";
import ProcessChatbotResponseMeta from "./ProcessChatbotResponseMeta";

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
 * Obtiene o crea los contactos necesarios (individual y grupo si aplica)
 */
const getOrCreateContacts = async (
  message: MetaWebhookMessage,
  value: any
): Promise<{ contact: Contact; groupContact?: Contact; isGroup: boolean }> => {
  const isGroup = !!message.group_id;
  let contact: Contact;
  let groupContact: Contact | undefined;

  if (isGroup) {
    // Buscar o crear contacto de grupo
    groupContact = await Contact.findOne({
      where: { number: message.group_id, isGroup: true }
    });

    if (!groupContact) {
      groupContact = await Contact.create({
        name: `Grupo ${message.group_id}`,
        number: message.group_id,
        isGroup: true,
        email: ""
      });
      console.log("[HandleMetaWebhookMessage] Grupo creado:", groupContact.id);
    }

    // Crear contacto del participante
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
    // Crear contacto individual
    const contactInfo = value.contacts?.find((c: any) => c.wa_id === message.from);
    const contactName = contactInfo?.profile?.name || message.from;
    const contactNumber = message.from;

    contact = await CreateOrUpdateContactService({
      name: contactName,
      number: contactNumber,
      isGroup: false,
      email: "",
      profilePicUrl: ""
    });

    console.log("[HandleMetaWebhookMessage] Contacto creado/actualizado:", contact.id);
  }

  return { contact, groupContact, isGroup };
};

/**
 * Configura el ticket: asigna departamento y determina si se debe procesar el bot
 */
const setupTicket = async (
  ticket: Ticket,
  whatsapp: Whatsapp,
  isGroup: boolean
): Promise<{ shouldSkipBot: boolean }> => {
  // Asignar departamento si no tiene uno
  if (!ticket.queueId && whatsapp.queues && whatsapp.queues.length > 0) {
    console.log(`[HandleMetaWebhookMessage] Asignando departamento al ticket ${ticket.id}...`);

    try {
      await UpdateTicketService({
        ticketData: { queueId: whatsapp.queues[0].id },
        ticketId: ticket.id
      });
      console.log(`[HandleMetaWebhookMessage] Departamento asignado: ${whatsapp.queues[0].name}`);
    } catch (err) {
      console.error(`[HandleMetaWebhookMessage] Error asignando departamento:`, err);
    }
  }

  // Determinar si se debe omitir el bot
  const shouldSkipBot = (
    isGroup ||
    ticket.status === "closed" ||
    ticket.userId != null ||
    ticket.messagingCampaignId != null ||
    ticket.marketingMessagingCampaignId != null
  );

  return { shouldSkipBot };
};

/**
 * Maneja todo el flujo del chatbot: bienvenida y procesamiento de respuestas
 */
const handleChatbot = async (
  ticket: Ticket,
  messageBody: string,
  contact: Contact,
  whatsapp: Whatsapp,
  shouldSkipBot: boolean,
  selectedOptionId?: string
): Promise<void> => {
  if (shouldSkipBot) return;

  // Disparar bot de bienvenida si es necesario
  if (!ticket.chatbotMessageIdentifier && !ticket.chatbotFinishedAt) {
    console.log(`[HandleMetaWebhookMessage] Disparando bot de bienvenida para ticket ${ticket.id}`);
    SendWelcomeBotMessageMeta({ ticket, contact, whatsapp }).catch(err => {
      console.error("[HandleMetaWebhookMessage] Error enviando bot de bienvenida:", err);
    });
  } else if (ticket.chatbotFinishedAt && !ticket.userId) {
    console.log(`[HandleMetaWebhookMessage] Bot ya terminó para ticket ${ticket.id}`);
  }

  // Procesar respuesta del chatbot si el ticket está en modo bot
  if (ticket.chatbotMessageIdentifier) {
    console.log(`[HandleMetaWebhookMessage] Procesando respuesta del chatbot para ticket ${ticket.id}`);
    try {
      await ProcessChatbotResponseMeta({
        ticket,
        userMessage: messageBody,
        contact,
        whatsapp,
        selectedOptionId
      });
      console.log(`[HandleMetaWebhookMessage] Respuesta del chatbot procesada exitosamente`);
    } catch (err) {
      console.error("[HandleMetaWebhookMessage] Error procesando chatbot:", err);
    }
  }
};

/**
 * Guarda el mensaje del usuario en la base de datos
 */
const saveUserMessage = async (
  message: MetaWebhookMessage,
  ticket: Ticket,
  contact: Contact,
  whatsapp: Whatsapp
): Promise<{ newMessage: Message; messageBody: string }> => {
  const mediaType = getMediaType(message);
  let mediaUrl: string | null = null;
  let messageBody = getMessageBody(message);

  // Descargar media si existe
  if (hasMedia(message)) {
    try {
      console.log("[HandleMetaWebhookMessage] Descargando media...");
      const mediaInfo = getMediaInfo(message);

      const downloadResult = await DownloadMetaMedia({
        mediaId: mediaInfo.id,
        accessToken: whatsapp.metaAccessToken,
        mimeType: mediaInfo.mimeType
      });

      mediaUrl = downloadResult.filename;
      if (!hasCaption(message)) {
        messageBody = downloadResult.filename;
      }

      console.log("[HandleMetaWebhookMessage] Media descargado:", mediaUrl);
    } catch (err) {
      console.error("[HandleMetaWebhookMessage] Error descargando media:", err);
    }
  }

  // Obtener mensaje citado si existe
  let quotedMsgId = null;
  if (message.context?.id) {
    const quotedMessage = await Message.findByPk(message.context.id);
    if (quotedMessage) {
      quotedMsgId = message.context.id;
    } else {
      console.log("[HandleMetaWebhookMessage] Mensaje citado no encontrado:", message.context.id);
    }
  }

  const newMessage = await Message.create({
    id: message.id,
    body: messageBody,
    ticketId: ticket.id,
    contactId: contact.id,
    fromMe: false,
    mediaType: mediaType,
    mediaUrl: mediaUrl,
    read: false,
    quotedMsgId: quotedMsgId,
    timestamp: parseInt(message.timestamp),
    ack: 0
  });

  console.log("[HandleMetaWebhookMessage] Mensaje guardado:", newMessage.id);

  await ticket.update({
    lastMessage: messageBody,
    lastMessageAt: new Date(parseInt(message.timestamp) * 1000)
  });

  return { newMessage, messageBody };
};

/**
 * Emite eventos socket para actualizar el frontend
 */
const emitSocketEvents = async (
  ticket: Ticket,
  newMessage: Message,
  contact: Contact
): Promise<void> => {
  const updatedTicket = await getAndSetBeenWaitingSinceTimestampTicketService(ticket) as Ticket;

  emitEvent({
    to: [ticket.id.toString(), ticket.status, "notification"],
    event: {
      name: "appMessage",
      data: {
        action: "create",
        message: newMessage,
        ticket: updatedTicket,
        contact: contact
      }
    }
  });

  emitEvent({
    to: [ticket.id.toString()],
    event: {
      name: "ticket",
      data: {
        action: "update",
        ticket: updatedTicket
      }
    }
  });

  console.log("[HandleMetaWebhookMessage] Eventos socket emitidos");
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

    if (message.type === "interactive") {
      console.log("[HandleMetaWebhookMessage] Mensaje interactivo detectado:", message.interactive?.type);
      if (message.interactive?.type === "list_reply") {
        console.log("[HandleMetaWebhookMessage] Opción seleccionada:", message.interactive.list_reply?.id);
      }
    }

    if (message.type === "unsupported") {
      console.warn("[HandleMetaWebhookMessage] Mensaje de tipo no soportado");
      if (message.errors?.length) {
        console.warn("[HandleMetaWebhookMessage] Errores:", JSON.stringify(message.errors));
      }
    }

    const { contact, groupContact, isGroup } = await getOrCreateContacts(message, value);

    let ticket = await FindOrCreateTicketService({
      contact,
      whatsappId: whatsapp.id,
      unreadMessages: 1,
      groupContact,
      lastMessageTimestamp: parseInt(message.timestamp),
      msgFromMe: false,
      body: getMessageBody(message)
    });

    console.log("[HandleMetaWebhookMessage] Ticket:", ticket.id);

    // ========================================
    // 🧪 TEMPORAL PARA PRUEBAS - INICIO
    // Para remover: Eliminar todo este bloque
    // ========================================
    const tempMessageBody = getMessageBody(message);
    const activationKeywords = ['iniciar', 'inicio'];
    const shouldActivateBot = activationKeywords.some(keyword =>
      tempMessageBody.toLowerCase().trim() === keyword
    );

    let skipChatbotProcessing = false;

    if (shouldActivateBot) {
      console.log(`[PRUEBA BOT META] Detectada palabra clave: "${tempMessageBody}"`);

      // Cerrar ticket actual si existe y está abierto
      if (ticket.status !== 'closed') {
        await ticket.update({ status: 'closed' });
        console.log(`[PRUEBA BOT META] Ticket ${ticket.id} cerrado`);
      }

      // Crear nuevo ticket con chatbot activado
      const chatbotIdentifier = whatsapp.chatbotIdentifier || 'soporte';
      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages: 1,
        whatsappId: whatsapp.id,
        lastMessageTimestamp: parseInt(message.timestamp),
        chatbotMessageIdentifier: chatbotIdentifier
      });

      console.log(`[PRUEBA BOT META] Nuevo ticket ${ticket.id} creado con bot activado (identifier: ${chatbotIdentifier})`);

      // Marcar para NO procesar el mensaje "iniciar" como respuesta del chatbot
      skipChatbotProcessing = true;
    }
    // ========================================
    // 🧪 TEMPORAL PARA PRUEBAS - FIN
    // ========================================

    const { shouldSkipBot } = await setupTicket(ticket, whatsapp, isGroup);
    const { newMessage, messageBody } = await saveUserMessage(message, ticket, contact, whatsapp);
    const selectedOptionId = getSelectedOptionId(message);

    // Solo procesar chatbot si NO acabamos de activarlo con palabra clave
    if (!skipChatbotProcessing) {
      await handleChatbot(ticket, messageBody, contact, whatsapp, shouldSkipBot, selectedOptionId);
    } else {
      // Enviar solo el mensaje de bienvenida
      console.log(`[PRUEBA BOT META] Enviando mensaje de bienvenida inicial`);
      SendWelcomeBotMessageMeta({ ticket, contact, whatsapp }).catch(err => {
        console.error("[PRUEBA BOT META] Error enviando bot de bienvenida:", err);
      });
    }

    await emitSocketEvents(ticket, newMessage, contact);

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
    case "interactive":
      if (message.interactive?.type === "list_reply") {
        return message.interactive.list_reply?.title || "";
      } else if (message.interactive?.type === "button_reply") {
        return message.interactive.button_reply?.title || "";
      }
      return "Mensaje interactivo";
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
 * Extrae el ID de la opción seleccionada de un mensaje interactivo
 */
const getSelectedOptionId = (message: MetaWebhookMessage): string | undefined => {
  if (message.type === "interactive") {
    if (message.interactive?.type === "list_reply") {
      return message.interactive.list_reply?.id;
    } else if (message.interactive?.type === "button_reply") {
      return message.interactive.button_reply?.id;
    }
  }
  return undefined;
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
