import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

export const StartAllWhatsAppsSessions = async (): Promise<void> => {

  // Aumenta el límite de listeners al inicio del script
  process.setMaxListeners(50);

  const whatsapps = await ListWhatsAppsService({ showAll: false });
  if (whatsapps.length > 0) {
    console.log(`[StartAllSessions] Found ${whatsapps.length} WhatsApps to initialize`);
    
    // Inicializar sesiones SECUENCIALMENTE con delay para evitar conflictos de perfil de Chrome
    for (let i = 0; i < whatsapps.length; i++) {
      const whatsapp = whatsapps[i];
      
      console.log(`[StartAllSessions] Initializing ${i + 1}/${whatsapps.length}: ${whatsapp.name} (ID: ${whatsapp.id})`);
      
      // Delay de 15 segundos entre cada sesión
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
      
      // IMPORTANTE: Esperar a que la sesión se inicialice completamente antes de continuar
      // Esto evita que múltiples Chrome intenten crear perfiles simultáneamente
      try {
        await StartWhatsAppSession(whatsapp);
        console.log(`[StartAllSessions] ✓ Session ${whatsapp.name} initialized successfully`);
      } catch (error) {
        console.error(`[StartAllSessions] ✗ Session ${whatsapp.name} failed:`, error?.message || error);
      }
    }
    
    console.log(`[StartAllSessions] All ${whatsapps.length} sessions initialization completed`);
  }
};
