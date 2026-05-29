import SendMessageRequest from "../../models/SendMessageRequest";
import Whatsapp from "../../models/Whatsapp";
import SendExternalWhatsAppMessageWbot from "../WbotServices/SendExternalWhatsAppMessageWbot";
import SendExternalWhatsAppMessageMeta from "../MetaServices/SendExternalWhatsAppMessageMeta";

/**
 * Dispatcher para envío externo de mensajes (sin ticket)
 * Detecta apiType y delega a Wbot o Meta
 */
const SendExternalWhatsAppMessage = async ({
  fromNumber,
  toNumber,
  message,
  createRegisterInDb = false,
  registerInDb = null
}: {
  fromNumber: string;
  toNumber: string;
  message: string;
  createRegisterInDb?: boolean;
  registerInDb?: SendMessageRequest;
}) => {
  console.log("[SendExternalWhatsAppMessage] Dispatcher iniciado");
  console.log("[SendExternalWhatsAppMessage] From:", fromNumber);
  console.log("[SendExternalWhatsAppMessage] To:", toNumber);

  // Buscar whatsapp para determinar apiType
  const whatsapp = await Whatsapp.findOne({
    where: { number: fromNumber }
  });

  if (!whatsapp) {
    console.log("[SendExternalWhatsAppMessage] WhatsApp no encontrado");
    return {
      wasOk: false,
      data: null,
      logs: [],
      errors: ["ERR_WAPP_NOT_FOUND"]
    };
  }

  const apiType = whatsapp.apiType || "whatsapp-web.js";
  console.log("[SendExternalWhatsAppMessage] ApiType:", apiType);

  // Delegar según apiType
  if (apiType === "meta-api") {
    console.log("[SendExternalWhatsAppMessage] Usando Meta API");
    return SendExternalWhatsAppMessageMeta({
      fromNumber,
      toNumber,
      message,
      createRegisterInDb,
      registerInDb
    });
  } else {
    console.log("[SendExternalWhatsAppMessage] Usando Puppeteer");
    return SendExternalWhatsAppMessageWbot({
      fromNumber,
      toNumber,
      message,
      createRegisterInDb,
      registerInDb
    });
  }
};

export default SendExternalWhatsAppMessage;
