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
    }
  } catch (err) {
    console.error(`[StartWhatsAppSession] Error initializing whatsapp ${whatsapp.id}. Error type:`, typeof err);
    console.error(`[StartWhatsAppSession] Error message:`, err?.message);
    console.error(`[StartWhatsAppSession] Error name:`, err?.name);
    console.error(`[StartWhatsAppSession] Error stack:`, err?.stack);
    console.error(`[StartWhatsAppSession] Full error:`, JSON.stringify(err, null, 2));
    logger.error(`[StartWhatsAppSession] Error initializing whatsapp ${whatsapp.id}`);
    
    await whatsapp.update({ 
      status: "DISCONNECTED",
      qrcode: ""
    });

    emitEvent({
      event: {
        name: "whatsappSession",
        data: {
          action: "update",
          session: whatsapp
        }
      }
    });
  }
};
