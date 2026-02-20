import { Client as Session } from "whatsapp-web.js";
import { getWbot } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";

const GetTicketWbot = async (ticket: Ticket): Promise<Session | null> => {
  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(ticket.user.id);

    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  // Verificar si el whatsapp usa Meta API
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  const apiType = whatsapp?.apiType || "whatsapp-web.js";

  if (apiType === "meta-api") {
    // Meta API no tiene sesión wbot
    return null;
  }

  const wbot = getWbot(ticket.whatsappId);

  return wbot;
};

export default GetTicketWbot;
