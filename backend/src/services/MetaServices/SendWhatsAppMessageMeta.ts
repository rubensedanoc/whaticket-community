import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import { MetaApiClient } from "../../clients/MetaApiClient";
import { MetaApiSuccessResponse } from "../../types/meta/MetaApiTypes";
import { emitEvent } from "../../libs/emitEvent";
import CheckMetaConversationWindow from "../../helpers/CheckMetaConversationWindow";
import getAndSetBeenWaitingSinceTimestampTicketService from "../TicketServices/getAndSetBeenWaitingSinceTimestampTicketService";
import { sendGoogleChatMetaError } from "../../helpers/SendGoogleChatLog";

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

    // Determinar número de destino
    let recipientNumber: string;
    
    if (ticket.isGroup) {
      recipientNumber = ticket.contact.number;
      console.log("[SendWhatsAppMessageMeta] Enviando a grupo:", recipientNumber);
    } else {
      recipientNumber = ticket.contact.number.replace(/^\+/, '');
      console.log("[SendWhatsAppMessageMeta] Número original:", ticket.contact.number);
      console.log("[SendWhatsAppMessageMeta] Número limpio:", recipientNumber);
    }

    // Preparar replyToMessageId si hay mensaje citado
    let replyToMessageId: string | undefined;
    if (quotedMsg) {
      replyToMessageId = quotedMsg.id;
      console.log("[SendWhatsAppMessageMeta] ReplyToMessageId:", replyToMessageId);
    }

    // Validar ventana de conversación solo para individuales
    let windowStatus: { isOpen: boolean; type: string };
    
    if (!ticket.isGroup) {
      windowStatus = await CheckMetaConversationWindow(ticket);
      console.log("[SendWhatsAppMessageMeta] Estado de ventana:", windowStatus);
    } else {
      console.log("[SendWhatsAppMessageMeta] Grupo: omitiendo validación de ventana de 24h");
      windowStatus = { isOpen: true, type: "active" };
    }

    let result: MetaApiSuccessResponse;

    if (!windowStatus.isOpen) {
      // Ventana cerrada o conversación nueva: Enviar plantilla apropiada
      let templateName: string;
      
      if (windowStatus.type === "new_conversation") {
        // Conversación inicial - usar plantilla de bienvenida
        templateName = process.env.META_INITIAL_TEMPLATE_NAME || "initial_conversation";
        console.log("[SendWhatsAppMessageMeta] ⚠️ Conversación inicial, enviando plantilla de bienvenida");
      } else {
        // Ventana expirada - usar plantilla de reengagement
        templateName = process.env.META_REENGAGEMENT_TEMPLATE_NAME || "reengagement_message";
        console.log("[SendWhatsAppMessageMeta] ⚠️ Ventana cerrada, enviando plantilla de reengagement");
      }
      
      try {
        // Limpiar el mensaje para la plantilla:
        // Meta no permite saltos de línea, tabs, ni más de 4 espacios consecutivos en parámetros
        const cleanedBody = bodyFormated
          .replace(/\n/g, ' ')           // Reemplazar saltos de línea con espacio
          .replace(/\t/g, ' ')           // Reemplazar tabs con espacio
          .replace(/\s{4,}/g, '   ')     // Reemplazar 4+ espacios con 3 espacios
          .trim();                       // Eliminar espacios al inicio/final

        console.log("[SendWhatsAppMessageMeta] Mensaje original:", bodyFormated);
        console.log("[SendWhatsAppMessageMeta] Mensaje limpio para plantilla:", cleanedBody);

        // Enviar plantilla con el mensaje del agente como parámetro
        result = await client.sendTemplate({
          to: recipientNumber,
          templateName: templateName,
          languageCode: "es",
          bodyParameters: [cleanedBody]
        });

        console.log(`[SendWhatsAppMessageMeta] ✅ Plantilla ${templateName} enviada con mensaje incluido`);
      } catch (templateErr) {
        console.error("[SendWhatsAppMessageMeta] ❌ Error enviando plantilla:", templateErr);
        
        console.log("[SendWhatsAppMessageMeta] Intentando enviar mensaje normal como fallback...");
        result = await client.sendText({
          to: recipientNumber,
          body: bodyFormated,
          replyToMessageId
        });
      }
    } else {
      // Ventana abierta: Enviar mensaje normal
      console.log("[SendWhatsAppMessageMeta] Enviando mensaje normal (ventana activa)");
      console.log("[SendWhatsAppMessageMeta] Enviando mensaje a:", recipientNumber);
      console.log("[SendWhatsAppMessageMeta] PhoneNumberId:", whatsapp.phoneNumberId);
      console.log("[SendWhatsAppMessageMeta] Payload:", JSON.stringify({
        to: recipientNumber,
        body: bodyFormated,
        replyToMessageId,
        recipientType: ticket.isGroup ? "group" : undefined
      }));

      result = await client.sendText({
        to: recipientNumber,
        body: bodyFormated,
        replyToMessageId,
        recipientType: ticket.isGroup ? "group" : undefined
      });
    }

    console.log("[SendWhatsAppMessageMeta] Respuesta completa de Meta API:", JSON.stringify(result, null, 2));

    const messageId = result.messages[0].id;
    console.log("[SendWhatsAppMessageMeta] Mensaje enviado exitosamente");
    console.log("[SendWhatsAppMessageMeta] MessageId:", messageId);
    console.log("[SendWhatsAppMessageMeta] WA_ID del contacto:", result.contacts[0]?.wa_id);

    // Guardar mensaje en BD (Meta no tiene eventos de socket como Puppeteer)
    // ack: 0 = pending, se actualizará cuando llegue el webhook de estado
    const newMessage = await Message.create({
      id: messageId,
      body: bodyFormated,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      quotedMsgId: quotedMsg?.id,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 0
    });

    // Actualizar último mensaje del ticket
    await ticket.update({ lastMessage: body });

    console.log("[SendWhatsAppMessageMeta] Mensaje guardado en BD:", newMessage.id);

    // Recalcular beenWaitingSinceTimestamp: si el CS ya respondió debe quedar null
    const updatedTicket = await getAndSetBeenWaitingSinceTimestampTicketService(ticket) as Ticket;

    // Emitir evento de socket para actualizar frontend
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

    sendGoogleChatMetaError({
      service: "SendWhatsAppMessageMeta",
      error: "Error al enviar mensaje",
      details: err?.message || err?.toString(),
      whatsappId: ticket.whatsappId,
      ticketId: ticket.id,
      contactNumber: ticket.contact.number
    });

    throw new AppError("ERR_SENDING_WAPP_MSG_META");
  }
};

export default SendWhatsAppMessageMeta;
