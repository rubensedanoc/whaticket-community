import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import SendWhatsAppMessageWbot from "../WbotServices/SendWhatsAppMessageWbot";
import SendWhatsAppMessageMeta from "../MetaServices/SendWhatsAppMessageMeta";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

/**
 * Dispatcher que decide si usar Puppeteer (wbot) o Meta API
 * según el apiType configurado en el whatsapp del ticket
 */
const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<any> => {
  console.log("[SendWhatsAppMessage] Dispatcher iniciado");

  // Siempre consultar whatsapp desde BD para tener datos completos (apiType, phoneNumberId, etc)
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  const apiType = whatsapp?.apiType || "whatsapp-web.js";

  console.log("[SendWhatsAppMessage] ApiType:", apiType);

  if (apiType === "meta-api") {
    console.log("[SendWhatsAppMessage] Usando Meta API");
    return SendWhatsAppMessageMeta({ body, ticket, whatsapp, quotedMsg });
  }

  console.log("[SendWhatsAppMessage] Usando Puppeteer (wbot)");
  return SendWhatsAppMessageWbot({ body, ticket, quotedMsg });
};

export default SendWhatsAppMessage;
