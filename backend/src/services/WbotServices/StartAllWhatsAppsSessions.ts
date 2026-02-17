import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import { logger } from "../../utils/logger";

export const StartAllWhatsAppsSessions = async (): Promise<void> => {

  // Aumenta el límite de listeners al inicio del script
  process.setMaxListeners(50);

  const whatsapps = await ListWhatsAppsService({ showAll: false });
  if (whatsapps.length > 0) {
    logger.info(`Starting ${whatsapps.length} WhatsApp sessions`);
    
    for (let i = 0; i < whatsapps.length; i++) {
      const whatsapp = whatsapps[i];
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
      
      try {
        await StartWhatsAppSession(whatsapp);
      } catch (error) {
        logger.error(`Session ${whatsapp.name} failed: ${error?.message || error}`);
      }
    }
    
    logger.info(`All sessions initialization completed`);
  }
};
