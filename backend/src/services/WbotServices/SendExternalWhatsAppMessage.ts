import * as Sentry from "@sentry/node";
import { MessageContent, Message as WbotMessage } from "whatsapp-web.js";
import AppError from "../../errors/AppError";

import { getWbot } from "../../libs/wbot";
import SendMessageRequest from "../../models/SendMessageRequest";
import Whatsapp from "../../models/Whatsapp";
import NotifyViaWppService from "../ExtraServices/NotifyViaWppService";

const SendExternalWhatsAppMessage = async ({
  fromNumber,
  toNumber,
  message,
  createRegisterInDb = false,
  registerInDb = null
}: {
  fromNumber: string;
  toNumber: string;
  message: MessageContent;
  createRegisterInDb?: boolean;
  registerInDb?: SendMessageRequest;
}) => {
  const result: {
    wasOk: boolean;
    data: WbotMessage;
    logs: string[];
    errors: string[];
  } = {
    wasOk: true,
    data: null,
    logs: [],
    errors: []
  };

  let fromWpp: Whatsapp;

  try {
    result.logs.push(`-- INICIO find fromWpp --- ${Date.now() / 1000}`);
    fromWpp = await Whatsapp.findOne({
      where: {
        number: fromNumber
      }
    });
    result.logs.push(`-- FIND find fromWpp --- ${Date.now() / 1000}`);

    if (!fromWpp) {
      throw new AppError("ERR_WAPP_NOT_FOUND");
    }

    const wbot = getWbot(fromWpp.id);

    if (createRegisterInDb) {
      result.logs.push(
        `-- INICIO create registerInDb --- ${Date.now() / 1000}`
      );
      registerInDb = await SendMessageRequest.create({
        fromNumber,
        toNumber,
        message
      });
      result.logs.push(`-- FIN create registerInDb --- ${Date.now() / 1000}`);
    }

    result.logs.push(`-- INICIO sendMessage --- ${Date.now() / 1000}`);
    const sentMessage = await wbot.sendMessage(`${toNumber}@c.us`, message);
    result.logs.push(`-- FIN sendMessage --- ${Date.now() / 1000}`);

    if (registerInDb) {
      result.logs.push(
        `-- INICIO update registerInDb --- ${Date.now() / 1000}`
      );
      registerInDb.update({
        status: "sent",
        timesAttempted: registerInDb.timesAttempted + 1
      });
      result.logs.push(`-- FIN update registerInDb --- ${Date.now() / 1000}`);
    }

    result.data = sentMessage;
  } catch (error) {
    console.log("Error en SendExternalWhatsAppMessage", error);
    Sentry.captureException("Error en SendExternalWhatsAppMessage", {
      extra: error
    });

    if (registerInDb) {
      result.logs.push(
        `-- INICIO update registerInDb --- ${Date.now() / 1000}`
      );
      registerInDb.update({
        status: "failed",
        timesAttempted: registerInDb.timesAttempted + 1
      });
      result.logs.push(`-- FIN update registerInDb --- ${Date.now() / 1000}`);
    }

    if (fromWpp && fromWpp.phoneToNotify) {
      result.logs.push(
        `-- INICIO NotifyViaWppService --- ${Date.now() / 1000}`
      );
      NotifyViaWppService({
        numberToNotify: fromWpp.phoneToNotify,
        messageToSend: `Error al enviar mensaje: "${message}" a ${toNumber}: ${error.message}`
      });
      result.logs.push(`-- FIN NotifyViaWppService --- ${Date.now() / 1000}`);
    }

    result.wasOk = false;
    result.errors.push(error.message);
  }

  return result;
};

export default SendExternalWhatsAppMessage;
