import { Op } from "sequelize";
import { emitEvent } from "../../libs/emitEvent";
import { initWbot } from "../../libs/wbot";
import SendMessageRequest from "../../models/SendMessageRequest";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import SendExternalWhatsAppMessage from "./SendExternalWhatsAppMessage";
import { wbotMessageListener } from "./wbotMessageListener";
import wbotMonitor from "./wbotMonitor";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp
): Promise<void> => {
  await whatsapp.update({ status: "OPENING" });

  // const io = getIO();

  emitEvent({
    event: {
      name: "whatsappSession",
      data: {
        action: "update",
        session: whatsapp
      }
    }
  });

  // io.emit("whatsappSession", {
  //   action: "update",
  //   session: whatsapp
  // });

  try {
    const wbot = await initWbot(whatsapp);
    if (!whatsapp.wasDeleted) {
      wbotMessageListener(wbot, whatsapp);
      wbotMonitor(wbot, whatsapp);

      // logger.info("--- search for SendMessageRequest failed's: ");

      // const failedSendMessageRequest = await SendMessageRequest.findAll({
      //   where: {
      //     status: "failed",
      //     timesAttempted: {
      //       [Op.lte]: 3
      //     }
      //   }
      // });

      // for (const failedRequest of failedSendMessageRequest) {
      //   try {
      //     await SendExternalWhatsAppMessage({
      //       fromNumber: failedRequest.fromNumber,
      //       toNumber: failedRequest.toNumber,
      //       message: failedRequest.message,
      //       registerInDb: failedRequest
      //     });
      //     await new Promise(resolve => setTimeout(resolve, 1500));
      //   } catch (error) {}
      // }
    }
  } catch (err) {
    logger.error(err);
  }
};
