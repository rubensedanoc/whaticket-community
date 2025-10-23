import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

export const StartAllWhatsAppsSessions = async (): Promise<void> => {

  // Aumenta el límite de listeners al inicio del script
  process.setMaxListeners(20);

  const whatsapps = await ListWhatsAppsService({ showAll: false });
  if (whatsapps.length > 0) {
    whatsapps.forEach(whatsapp => {
      StartWhatsAppSession(whatsapp);
    });
  }
};
