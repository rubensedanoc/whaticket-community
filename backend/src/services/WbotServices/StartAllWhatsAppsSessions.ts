import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

export const StartAllWhatsAppsSessions = async (): Promise<void> => {

  // Aumenta el límite de listeners al inicio del script
  process.setMaxListeners(50);

  const whatsapps = await ListWhatsAppsService({ showAll: false });
  if (whatsapps.length > 0) {
    // Inicializar sesiones con delay progresivo para evitar sobrecarga
    for (let i = 0; i < whatsapps.length; i++) {
      const whatsapp = whatsapps[i];
      
      // Delay de 3 segundos entre cada sesión
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      StartWhatsAppSession(whatsapp);
    }
  }
};
