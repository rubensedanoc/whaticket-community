import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { MetaApiSuccessResponse } from "../../types/meta/MetaApiTypes";
import { emitEvent } from "../../libs/emitEvent";

interface Request {
  body: string;
  ticket: Ticket;
  whatsapp: Whatsapp;
  quotedMsg?: Message;
}

interface MetaMessageResult {
  id: string;
  fromMe: boolean;
  isMetaApi: true;
}

const SendWhatsAppMessageMeta = async ({
  body,
  ticket,
  whatsapp,
  quotedMsg
}: Request): Promise<MetaMessageResult> => {
  try {
    console.log("[SendWhatsAppMessageMeta] Iniciando envio");
    console.log("[SendWhatsAppMessageMeta] TicketId:", ticket.id);
    console.log("[SendWhatsAppMessageMeta] WhatsappId:", ticket.whatsappId);
    console.log("[SendWhatsAppMessageMeta] ContactNumber:", ticket.contact.number);
    console.log("[SendWhatsAppMessageMeta] Body length:", body.length);

    // Validar credenciales del whatsapp
    if (!whatsapp || !whatsapp.phoneNumberId || !whatsapp.metaAccessToken) {
      throw new AppError("ERR_META_CREDENTIALS_NOT_CONFIGURED");
    }

    // Crear cliente Meta API
    const client = new MetaApiClient({
      phoneNumberId: whatsapp.phoneNumberId,
      accessToken: whatsapp.metaAccessToken
    });

    // Formatear el cuerpo del mensaje
    const bodyFormated = formatBody(body, ticket.contact);
    console.log("[SendWhatsAppMessageMeta] Body formateado OK");

    // Preparar replyToMessageId si hay mensaje citado
    let replyToMessageId: string | undefined;
    if (quotedMsg) {
      // Para Meta API, usamos directamente el ID del mensaje (formato wamid.xxx)
      replyToMessageId = quotedMsg.id;
      console.log("[SendWhatsAppMessageMeta] ReplyToMessageId:", replyToMessageId);
    }

    // Enviar mensaje
    console.log("[SendWhatsAppMessageMeta] Enviando mensaje a:", ticket.contact.number);
    
    const result: MetaApiSuccessResponse = await client.sendText({
      to: ticket.contact.number,
      body: bodyFormated,
      replyToMessageId
    });

    const messageId = result.messages[0].id;
    console.log("[SendWhatsAppMessageMeta] Mensaje enviado exitosamente");
    console.log("[SendWhatsAppMessageMeta] MessageId:", messageId);

    // Guardar mensaje en BD (Meta no tiene eventos de socket como Puppeteer)
    const newMessage = await Message.create({
      id: messageId,
      body: bodyFormated,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      quotedMsgId: quotedMsg?.id
    });

    // Actualizar último mensaje del ticket
    await ticket.update({ lastMessage: body });

    console.log("[SendWhatsAppMessageMeta] Mensaje guardado en BD:", newMessage.id);

    // Emitir evento de socket para actualizar frontend
    emitEvent({
      to: [ticket.id.toString()],
      event: {
        name: "appMessage",
        data: {
          action: "create",
          message: newMessage,
          ticket,
          contact: ticket.contact
        }
      }
    });

    // Retornar objeto compatible con el flujo existente
    return {
      id: messageId,
      fromMe: true,
      isMetaApi: true
    };

  } catch (err) {
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMessageMeta] ❌ ERROR CAPTURADO");
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMessageMeta] ERROR TicketId:", ticket.id);
    console.log("[SendWhatsAppMessageMeta] ERROR WhatsappId:", ticket.whatsappId);
    console.log("[SendWhatsAppMessageMeta] ERROR ContactNumber:", ticket.contact.number);
    console.log("[SendWhatsAppMessageMeta] ERROR Message:", err.message);
    console.log("[SendWhatsAppMessageMeta] ERROR Stack:", err.stack);
    
    Sentry.captureException(err);

    throw new AppError("ERR_SENDING_WAPP_MSG_META");
  }
};

export default SendWhatsAppMessageMeta;
