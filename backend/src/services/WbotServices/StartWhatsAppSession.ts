import { emitEvent } from "../../libs/emitEvent";
import { initWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
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
    wbotMessageListener(wbot, whatsapp);
    wbotMonitor(wbot, whatsapp);
  } catch (err) {
    logger.error(err);
  }
};
