import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import SendWhatsAppMediaWbot from "../WbotServices/SendWhatsAppMediaWbot";
import SendWhatsAppMediaMeta from "../MetaServices/SendWhatsAppMediaMeta";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<any> => {
  console.log("[SendWhatsAppMedia] Dispatcher iniciado");

  // Siempre consultar whatsapp desde BD para tener datos completos (apiType, phoneNumberId, etc)
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  const apiType = whatsapp?.apiType || "whatsapp-web.js";

  console.log("[SendWhatsAppMedia] ApiType:", apiType);

  if (apiType === "meta-api") {
    console.log("[SendWhatsAppMedia] Usando Meta API");
    return SendWhatsAppMediaMeta({ media, ticket, whatsapp, body });
  }

  console.log("[SendWhatsAppMedia] Usando Puppeteer (wbot)");
  return SendWhatsAppMediaWbot({ media, ticket, body });
};

export default SendWhatsAppMedia;
