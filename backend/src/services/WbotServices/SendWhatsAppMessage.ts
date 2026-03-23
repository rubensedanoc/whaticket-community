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
    
    if (wbot?.pupPage) {
      console.log("[SendWhatsAppMessage] pupPage.isClosed():", wbot.pupPage.isClosed());
      try {
        console.log("[SendWhatsAppMessage] pupPage.url():", wbot.pupPage.url());
      } catch (urlErr) {
        console.log("[SendWhatsAppMessage] WARNING: No se pudo obtener URL:", urlErr.message);
      }
    }
    
    try {
      const wbotState = await wbot.getState();
      console.log("[SendWhatsAppMessage] Estado de la conexión:", wbotState);
      
      if (wbotState === null) {
        console.log("[SendWhatsAppMessage] WARNING: getState() retornó null - indica timing issue o window.Store.AppState no inicializado");
      }
    } catch (stateErr) {
      console.log("[SendWhatsAppMessage] WARNING: No se pudo obtener estado:", stateErr.message);
    }

    const bodyFormated = formatBody(body, ticket.contact);

    console.log("[SendWhatsAppMessage] Body formateado OK");

    // Intentar aplicar parches en la sesión si es posible (on-demand)
    // NOTA: Esto es redundante si el parche del evento 'ready' ya se aplicó
    // El parche on-demand es OPCIONAL, no debe abortar el envío si falla
    if (wbot?.pupPage) {
      try {
        console.log("[SendWhatsAppMessage] Intentando aplicar parche on-demand...");
        const patched = await applyPatchesToWbot(wbot as any);
        
        if (patched) {
          console.log("[SendWhatsAppMessage] ✓ Parche on-demand aplicado/verificado OK");
        } else {
          console.log("[SendWhatsAppMessage] ⚠ WARNING: Parche on-demand no se aplicó");
          console.log("[SendWhatsAppMessage] Esto puede ser normal si el parche del evento 'ready' ya está activo");
          console.log("[SendWhatsAppMessage] Continuando con el envío del mensaje...");
          // NO lanzar error, continuar con el envío
        }
      } catch (patchErr) {
        console.log("[SendWhatsAppMessage] ⚠ WARNING: Error aplicando parche on-demand:", patchErr?.message || patchErr);
        console.log("[SendWhatsAppMessage] Continuando con el envío - el parche del evento 'ready' probablemente está activo");
        // NO lanzar error, continuar con el envío
        // Si realmente falta el parche, wbot.sendMessage() fallará con un error más específico
      }
    } else {
      console.log("[SendWhatsAppMessage] WARNING: pupPage no disponible, no se puede aplicar parche on-demand");
      console.log("[SendWhatsAppMessage] Confiando en el parche del evento 'ready'");
    }

    let mentionedNumbers: string[] | null = null;

    if (ticket.isGroup) {
      mentionedNumbers = bodyFormated
        .match(/@(\d+)/g)
        ?.map(match => match.slice(1));
      console.log("[SendWhatsAppMessage] MentionedNumbers:", mentionedNumbers);
    }

    const destinationNumber = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
    console.log("[SendWhatsAppMessage] DestinationNumber:", destinationNumber);
    console.log("[SendWhatsAppMessage] QuotedMsgId:", quotedMsgSerializedId || "none");
    console.log("[SendWhatsAppMessage] Enviando mensaje...");

    // Intentar enviar mensaje con captura detallada de error
    let sentMessage;
    try {
      sentMessage = await wbot.sendMessage(
        destinationNumber,
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
