import * as Sentry from "@sentry/node";
import { MessageMedia, Message as WbotMessage } from "whatsapp-web.js";
import AppError from "../../errors/AppError";

import { getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";

const SendExternalWhatsAppImageMessage = async ({
  fromNumber,
  toNumber,
  imageUrl,
  caption
}: {
  fromNumber: string;
  toNumber: string;
  imageUrl: string;
  caption?: string;
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

    const imageMedia = await MessageMedia.fromUrl(imageUrl);

    const sentMessage = await wbot.sendMessage(`${toNumber}@c.us`, imageMedia, {
      caption
    });

    return sentMessage;
  } catch (err) {
    console.log("Error en SendInformalWhatsAppMessage", err);
    Sentry.captureException(err);
    throw new AppError("ERR_SENDING_INFORMAL_WAPP_MSG");
  }
};

export default SendExternalWhatsAppImageMessage;
