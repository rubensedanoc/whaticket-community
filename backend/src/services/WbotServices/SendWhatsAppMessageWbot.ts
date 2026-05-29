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
import { verifyMessage } from "./wbotMessageListener";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessageWbot = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<WbotMessage> => {
  try {
    console.log("[SendWhatsAppMessageWbot] Iniciando envio");
    console.log("[SendWhatsAppMessageWbot] TicketId:", ticket.id);
    console.log("[SendWhatsAppMessageWbot] WhatsappId:", ticket.whatsappId);
    console.log(
      "[SendWhatsAppMessageWbot] ContactNumber:",
      ticket.contact.number
    );
    console.log("[SendWhatsAppMessageWbot] IsGroup:", ticket.isGroup);
    console.log("[SendWhatsAppMessageWbot] Body length:", body.length);

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
    console.log("[SendWhatsAppMessageWbot] Wbot obtenido");
    // @ts-ignore - id se agrega dinámicamente en wbot.ts
    console.log("[SendWhatsAppMessageWbot] Wbot ID:", wbot.id || "unknown");
    console.log("[SendWhatsAppMessageWbot] Wbot info existe:", !!wbot.info);
    console.log(
      "[SendWhatsAppMessageWbot] Wbot pupPage existe:",
      !!wbot.pupPage
    );

    try {
      const wbotState = await wbot.getState();
      console.log(
        "[SendWhatsAppMessageWbot] Estado de la conexión:",
        wbotState
      );
    } catch (stateErr) {
      console.log(
        "[SendWhatsAppMessageWbot] WARNING: No se pudo obtener estado:",
        stateErr.message
      );
    }

    const bodyFormated = formatBody(body, ticket.contact);

    console.log("[SendWhatsAppMessageWbot] Body formateado OK");

    // Intentar aplicar parches en la sesión si es posible (on-demand)
    try {
      if (wbot?.pupPage) {
        const patched = await applyPatchesToWbot(wbot as any);
        if (!patched) {
          console.log(
            "[SendWhatsAppMessageWbot] WARNING: No se pudo aplicar el parche on-demand en esta sesión"
          );
          throw new Error("ERR_PATCH_NOT_APPLIED");
        }
        console.log("[SendWhatsAppMessageWbot] Parche on-demand aplicado OK");
      }
    } catch (patchErr) {
      console.log(
        "[SendWhatsAppMessageWbot] ERROR aplicando parche on-demand:",
        patchErr?.message || patchErr
      );
      throw patchErr;
    }

    let mentionedNumbers: string[] | null = null;

    if (ticket.isGroup) {
      mentionedNumbers = bodyFormated
        .match(/@(\d+)/g)
        ?.map(match => match.slice(1));
      console.log(
        "[SendWhatsAppMessageWbot] MentionedNumbers:",
        mentionedNumbers
      );
    }

    const destinationNumber = `${ticket.contact.number}@${
      ticket.isGroup ? "g" : "c"
    }.us`;
    console.log(
      "[SendWhatsAppMessageWbot] DestinationNumber:",
      destinationNumber
    );
    console.log(
      "[SendWhatsAppMessageWbot] QuotedMsgId:",
      quotedMsgSerializedId || "none"
    );
    console.log("[SendWhatsAppMessageWbot] Enviando mensaje...");

    // Intentar enviar mensaje con captura detallada de error
    let sentMessage;
    try {
      sentMessage = await wbot.sendMessage(destinationNumber, bodyFormated, {
        quotedMessageId: quotedMsgSerializedId,
        linkPreview: false,
        ...(mentionedNumbers &&
          mentionedNumbers.length > 0 && {
            mentions: mentionedNumbers.map(
              number => number + (number.length >= 14 ? "@lid" : "@c.us")
            )
          })
      });
    } catch (sendError) {
      console.log(
        "[SendWhatsAppMessageWbot] ERROR DETALLADO en wbot.sendMessage:"
      );
      console.log("[SendWhatsAppMessageWbot] - Error name:", sendError.name);
      console.log(
        "[SendWhatsAppMessageWbot] - Error message:",
        sendError.message
      );
      console.log(
        "[SendWhatsAppMessageWbot] - Error en método de librería whatsapp-web.js"
      );
      console.log(
        "[SendWhatsAppMessageWbot] - Indica que el parche NO se aplicó correctamente a esta sesión"
      );
      console.log(
        "[SendWhatsAppMessageWbot] - Solución: Reconectar WhatsApp ID",
        ticket.whatsappId
      );
      throw sendError;
    }

    console.log("[SendWhatsAppMessageWbot] Mensaje enviado exitosamente");
    console.log(
      "[SendWhatsAppMessageWbot] MessageId:",
      sentMessage.id._serialized
    );

    await ticket.update({ lastMessage: body });
    // Guardar el mensaje en la base de datos y emitir eventos al frontend
    await verifyMessage({
      msg: sentMessage,
      ticket: ticket,
      contact: ticket.contact,
      skipUnreadReset: true
    });

    return sentMessage;
  } catch (err) {
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMessageWbot] ❌ ERROR CAPTURADO EN CATCH PRINCIPAL");
    console.log("=".repeat(80));
    console.log("[SendWhatsAppMessageWbot] ERROR TicketId:", ticket.id);
    console.log("[SendWhatsAppMessageWbot] ERROR WhatsappId:", ticket.whatsappId);
    console.log("[SendWhatsAppMessageWbot] ERROR ContactNumber:", ticket.contact.number);
    console.log("[SendWhatsAppMessageWbot] ERROR IsGroup:", ticket.isGroup);
    console.log("[SendWhatsAppMessageWbot] ERROR Message:", err.message);
    console.log("[SendWhatsAppMessageWbot] ERROR Name:", err.name);

    // Diagnóstico específico del error
    if (err.message && err.message.includes("Cannot read properties of undefined (reading 'getChat')")) {
      console.log("=".repeat(80));
      console.log("[SendWhatsAppMessageWbot] 🔍 DIAGNÓSTICO:");
      console.log("[SendWhatsAppMessageWbot] - Este es un error de la LIBRERÍA whatsapp-web.js");
      console.log("[SendWhatsAppMessageWbot] - El método getChat() está devolviendo undefined");
      console.log("[SendWhatsAppMessageWbot] - El parche en wbot.ts NO está aplicado a esta sesión");
      console.log("[SendWhatsAppMessageWbot] - SOLUCIÓN: Desconectar y reconectar WhatsApp ID:", ticket.whatsappId);
      console.log("=".repeat(80));
    } else {
      console.log("[SendWhatsAppMessageWbot] ERROR Stack:", err.stack);
    }

    Sentry.captureException(err);

    if (err && err?.message === "ERR_FETCH_WAPP_MSG") {
      throw new AppError("ERR_FETCH_WAPP_MSG");
    }

    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessageWbot;
