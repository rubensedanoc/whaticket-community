import * as Sentry from "@sentry/node";
import { Message as WbotMessage } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import { Op } from "sequelize";
import formatBody from "../../helpers/Mustache";
import { applyPatchesToWbot } from "../../libs/wbot";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<WbotMessage> => {
  try {
    console.log("[SendWhatsAppMessage] Iniciando envio");
    console.log("[SendWhatsAppMessage] TicketId:", ticket.id);
    console.log("[SendWhatsAppMessage] WhatsappId:", ticket.whatsappId);
    console.log("[SendWhatsAppMessage] ContactNumber:", ticket.contact.number);
    console.log("[SendWhatsAppMessage] IsGroup:", ticket.isGroup);
    console.log("[SendWhatsAppMessage] Body length:", body.length);
    
    let quotedMsgSerializedId: string | undefined;

    if (quotedMsg) {
      let originalQuotedMsg: Message | null = null;
      // console.log("--- quotedMsg: ", quotedMsg);

      if (quotedMsg.isDuplicated) {
        originalQuotedMsg = await Message.findOne({
          where: {
            body: quotedMsg.body,
            isDuplicated: {
              [Op.or]: [false, null]
            }
          }
        });

        if (!originalQuotedMsg) {
          throw new AppError("ERR_ORIGINAL_QUOTED_MSG_NOT_FOUND");
        }

        // console.log("--- originalQuotedMsg: ", originalQuotedMsg);
      }

      const WbotMessageFound = await GetWbotMessage(
        ticket,
        quotedMsg.isDuplicated && originalQuotedMsg
          ? originalQuotedMsg.id
          : quotedMsg.id
      );

      quotedMsgSerializedId = WbotMessageFound.id._serialized;
    }

    const wbot = await GetTicketWbot(ticket);

    // Logs de diagnóstico para verificar estado del wbot
    console.log("[SendWhatsAppMessage] Wbot obtenido");
    // @ts-ignore - id se agrega dinámicamente en wbot.ts
    console.log("[SendWhatsAppMessage] Wbot ID:", wbot.id || "unknown");
    console.log("[SendWhatsAppMessage] Wbot info existe:", !!wbot.info);
    console.log("[SendWhatsAppMessage] Wbot pupPage existe:", !!wbot.pupPage);
    
    // VALIDACIÓN 1: Verificar estado de conexión
    try {
      const wbotState = await wbot.getState();
      console.log("[SendWhatsAppMessage] Estado de la conexión:", wbotState);
      
      // Lista de estados válidos para enviar mensajes
      const validStates = ['CONNECTED', 'PAIRING', 'OPENING'];
      
      if (!validStates.includes(wbotState)) {
        throw new AppError(
          `ERR_WAPP_NOT_READY: WhatsApp ID ${ticket.whatsappId} está en estado ${wbotState}. ` +
          `Estados válidos: ${validStates.join(', ')}. Por favor reconecte.`,
          400
        );
      }
      
      console.log(`[SendWhatsAppMessage] ✓ Estado válido: ${wbotState}`);
    } catch (stateErr) {
      if (stateErr.message?.includes('ERR_WAPP_NOT_READY')) {
        throw stateErr;
      }
      console.log("[SendWhatsAppMessage] WARNING: No se pudo obtener estado:", stateErr.message);
      // Si no se puede obtener el estado, continuar con precaución
    }

    // VALIDACIÓN 2: Verificar que los parches están aplicados
    if (wbot?.pupPage && !wbot.pupPage.isClosed()) {
      try {
        const patchStatus = await wbot.pupPage.evaluate(() => {
          return {
            applied: !!(window as any).__whaticket_patch_applied,
            wwebjsExists: typeof (window as any).WWebJS !== 'undefined',
            getChatExists: typeof (window as any).WWebJS?.getChat === 'function'
          };
        });
        
        if (!patchStatus.applied || !patchStatus.wwebjsExists || !patchStatus.getChatExists) {
          console.error(`[SendWhatsAppMessage] Patches not applied for WhatsApp ${ticket.whatsappId}`, patchStatus);
          throw new AppError(
            `ERR_WAPP_PATCHES_NOT_APPLIED: WhatsApp ID ${ticket.whatsappId} no está completamente inicializado. Por favor reconecte.`,
            500
          );
        }
        
        console.log("[SendWhatsAppMessage] ✓ Patches validated OK");
      } catch (validationErr) {
        if (validationErr.message?.includes('ERR_WAPP_PATCHES_NOT_APPLIED')) {
          throw validationErr;
        }
        console.error(`[SendWhatsAppMessage] Could not validate patches:`, validationErr.message);
        // Si la validación falla por otro motivo (ej: página cerrada), continuar con precaución
      }
    }

    const bodyFormated = formatBody(body, ticket.contact);

    console.log("[SendWhatsAppMessage] Body formateado OK");

    // Intentar aplicar parches en la sesión si es posible (on-demand)
    // Esto es opcional - los parches deberían haberse aplicado en el evento 'ready'
    // Si falla aquí, no es crítico, solo continuamos
    try {
      if (wbot?.pupPage) {
        const patched = await applyPatchesToWbot(wbot as any);
        if (patched) {
          console.log("[SendWhatsAppMessage] ✓ Parche on-demand aplicado/verificado OK");
        } else {
          console.log("[SendWhatsAppMessage] ⚠ Parche on-demand no aplicado (probablemente ya aplicado en ready)");
        }
      }
    } catch (patchErr) {
      console.log("[SendWhatsAppMessage] ⚠ No se pudo verificar/aplicar parche on-demand:", patchErr?.message || patchErr);
      console.log("[SendWhatsAppMessage] Continuando de todas formas (parche debería estar aplicado desde ready)");
      // No lanzamos error, continuamos con el envío
    }

    let mentionedNumbers: string[] | null = null;

    if (ticket.isGroup) {
      mentionedNumbers = bodyFormated
        .match(/@(\d+)/g)
        ?.map(match => match.slice(1));
      console.log("[SendWhatsAppMessage] MentionedNumbers:", mentionedNumbers);
    }

    // Obtener el ID correcto del destinatario (maneja @c.us y @lid)
    let destinationId: string;
    
    if (ticket.isGroup) {
      // Para grupos, usar el formato tradicional
      destinationId = `${ticket.contact.number}@g.us`;
      console.log("[SendWhatsAppMessage] Grupo detectado, usando:", destinationId);
    } else {
      // Para contactos individuales, obtener el ID correcto con getNumberId
      console.log("[SendWhatsAppMessage] 🔍 Obteniendo ID correcto para:", ticket.contact.number);
      
      try {
        const numberId = await wbot.getNumberId(`${ticket.contact.number}@c.us`);
        
        if (!numberId) {
          console.error("[SendWhatsAppMessage] ❌ No se pudo obtener el ID del número");
          throw new AppError("ERR_NUMBER_NOT_REGISTERED");
        }
        
        destinationId = numberId._serialized;
        console.log("[SendWhatsAppMessage] ✅ ID obtenido:", destinationId);
      } catch (numberIdErr) {
        console.error("[SendWhatsAppMessage] Error obteniendo numberId:", numberIdErr);
        // Fallback al formato tradicional
        destinationId = `${ticket.contact.number}@c.us`;
        console.log("[SendWhatsAppMessage] ⚠️ Usando fallback:", destinationId);
      }
    }

    console.log("[SendWhatsAppMessage] DestinationId final:", destinationId);
    console.log("[SendWhatsAppMessage] QuotedMsgId:", quotedMsgSerializedId || "none");
    console.log("[SendWhatsAppMessage] Enviando mensaje...");

    // Intentar enviar mensaje con captura detallada de error
    let sentMessage;
    try {
      sentMessage = await wbot.sendMessage(
        destinationId,
        bodyFormated,
        {
          quotedMessageId: quotedMsgSerializedId,
          linkPreview: false,
          ...(mentionedNumbers &&
            mentionedNumbers.length > 0 && {
              mentions: mentionedNumbers.map(
                number => number + (number.length >= 14 ? "@lid" : "@c.us")
              )
            })
        }
      );
    } catch (sendError) {
      console.log("[SendWhatsAppMessage] ERROR DETALLADO en wbot.sendMessage:");
      console.log("[SendWhatsAppMessage] - Error name:", sendError.name);
      console.log("[SendWhatsAppMessage] - Error message:", sendError.message);
      console.log("[SendWhatsAppMessage] - Error en método de librería whatsapp-web.js");
      console.log("[SendWhatsAppMessage] - Indica que el parche NO se aplicó correctamente a esta sesión");
      console.log("[SendWhatsAppMessage] - Solución: Reconectar WhatsApp ID", ticket.whatsappId);
      throw sendError;
    }

    console.log("[SendWhatsAppMessage] Mensaje enviado exitosamente");
    console.log("[SendWhatsAppMessage] MessageId:", sentMessage.id._serialized);

    await ticket.update({ lastMessage: body });
    return sentMessage;
  } catch (err) {
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMessage] ❌ ERROR CAPTURADO EN CATCH PRINCIPAL");
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMessage] ERROR TicketId:", ticket.id);
    console.log("[SendWhatsAppMessage] ERROR WhatsappId:", ticket.whatsappId);
    console.log("[SendWhatsAppMessage] ERROR ContactNumber:", ticket.contact.number);
    console.log("[SendWhatsAppMessage] ERROR IsGroup:", ticket.isGroup);
    console.log("[SendWhatsAppMessage] ERROR Message:", err.message);
    console.log("[SendWhatsAppMessage] ERROR Name:", err.name);
    
    // Diagnóstico específico del error
    if (err.message && err.message.includes("Cannot read properties of undefined (reading 'getChat')")) {
      console.log("=".repeat(80));
      console.log("[SendWhatsAppMessage] 🔍 DIAGNÓSTICO:");
      console.log("[SendWhatsAppMessage] - Este es un error de la LIBRERÍA whatsapp-web.js");
      console.log("[SendWhatsAppMessage] - El método getChat() está devolviendo undefined");
      console.log("[SendWhatsAppMessage] - El parche en wbot.ts NO está aplicado a esta sesión");
      console.log("[SendWhatsAppMessage] - SOLUCIÓN: Desconectar y reconectar WhatsApp ID:", ticket.whatsappId);
      console.log("=".repeat(80));
    } else {
      console.log("[SendWhatsAppMessage] ERROR Stack:", err.stack);
    }
    
    Sentry.captureException(err);

    if (err && err?.message === "ERR_FETCH_WAPP_MSG") {
      throw new AppError("ERR_FETCH_WAPP_MSG");
    }

    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
