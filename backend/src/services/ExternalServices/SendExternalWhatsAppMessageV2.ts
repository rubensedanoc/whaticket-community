import Whatsapp from "../../models/Whatsapp";
import { addMessageToQueueWbot } from "../WbotServices/SendExternalWhatsAppMessageV2Wbot";
import { addMessageToQueueMeta } from "../MetaServices/SendExternalWhatsAppMessageV2Meta";

/**
 * Dispatcher para envío externo con cola (V2)
 * Detecta apiType y delega a cola Wbot o Meta
 */
export const addMessageToQueue = async ({
  fromNumber,
  toNumber,
  message,
  mediaUrl = null
}: {
  fromNumber: string;
  toNumber: string;
  message: string;
  mediaUrl?: string | null;
}) => {
  console.log("[SendExternalWhatsAppMessageV2] Dispatcher iniciado");
  console.log("[SendExternalWhatsAppMessageV2] From:", fromNumber);
  console.log("[SendExternalWhatsAppMessageV2] To:", toNumber);

  // Limpiar número para buscar
  const cleanFromNumber = fromNumber.replace(/\D/g, '').trim();

  // Buscar whatsapp para determinar apiType
  const whatsapp = await Whatsapp.findOne({
    where: { number: cleanFromNumber }
  });

  if (!whatsapp) {
    console.log("[SendExternalWhatsAppMessageV2] WhatsApp no encontrado");
    return {
      mensajes: ["ERR_WAPP_NOT_FOUND"],
      data: null
    };
  }

  const apiType = whatsapp.apiType || "whatsapp-web.js";
  console.log("[SendExternalWhatsAppMessageV2] ApiType:", apiType);

  // Delegar según apiType
  if (apiType === "meta-api") {
    console.log("[SendExternalWhatsAppMessageV2] Usando cola Meta API");
    return addMessageToQueueMeta({
      fromNumber,
      toNumber,
      message,
      mediaUrl
    });
  } else {
    console.log("[SendExternalWhatsAppMessageV2] Usando cola Puppeteer");
    return addMessageToQueueWbot({
      fromNumber,
      toNumber,
      message,
      mediaUrl
    });
  }
};
