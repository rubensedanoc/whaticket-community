import * as Sentry from "@sentry/node";
import { MessageContent, Message as WbotMessage } from "whatsapp-web.js";
import AppError from "../../errors/AppError";

import { getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";

const SendExternalWhatsAppMessage = async ({
  fromNumber,
  toNumber,
  message
}: {
  fromNumber: string;
  toNumber: string;
  message: MessageContent;
}): Promise<WbotMessage> => {
  try {
    const fromWpp = await Whatsapp.findOne({
      where: {
        number: fromNumber
      }
    });

    if (!fromWpp) {
      throw new AppError("ERR_WAPP_NOT_FOUND");
    }

    const wbot = getWbot(fromWpp.id);

    const sentMessage = await wbot.sendMessage(`${toNumber}@c.us`, message);

    return sentMessage;
  } catch (err) {
    console.log("Error en SendInformalWhatsAppMessage", err);
    Sentry.captureException(err);
    throw new AppError("ERR_SENDING_INFORMAL_WAPP_MSG");
  }
};

export default SendExternalWhatsAppMessage;
