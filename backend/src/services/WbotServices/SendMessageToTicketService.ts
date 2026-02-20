import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import { verifyMessage } from "./wbotMessageListener";

interface CalendarEvent {
  id?: string;
  summary?: string;
  start?: {
    dateTime: string;
    timeZone: string;
  };
  end?: {
    dateTime: string;
    timeZone: string;
  };
  description?: string;
  attendees?: Array<{
    email: string;
    responseStatus: string;
  }>;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      uri: string;
      entryPointType: string;
    }>;
  };
  [key: string]: any;
}

interface Request {
  ticketId: number;
  message: string;
  calendarEvent?: CalendarEvent;
}

interface ServiceResponse {
  success: boolean;
  data?: {
    ticketId: number;
    messageId: string;
    groupName: string;
    sentAt: Date;
  };
  error?: string;
  message?: string;
}

const SendMessageToTicketService = async ({
  ticketId,
  message,
  calendarEvent
}: Request): Promise<ServiceResponse> => {
  try {
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: Contact,
          as: "contact"
        },
        {
          model: Whatsapp,
          as: "whatsapp"
        }
      ]
    });

    if (!ticket) {
      return {
        success: false,
        error: "TICKET_NOT_FOUND",
        message: `No se encontró el ticket con ID ${ticketId}`
      };
    }

    if (!ticket.whatsapp) {
      return {
        success: false,
        error: "WHATSAPP_NOT_FOUND",
        message: `No se encontró la conexión de WhatsApp para el ticket ${ticketId}`
      };
    }

    const validStatuses = ["CONNECTED", "PAIRING", "OPENING"];
    if (!validStatuses.includes(ticket.whatsapp.status)) {
      return {
        success: false,
        error: "WHATSAPP_DISCONNECTED",
        message: `La conexión de WhatsApp no está activa. Estado actual: ${ticket.whatsapp.status}`
      };
    }

    let finalMessage = message;
    
    if (calendarEvent?.hangoutLink) {
      finalMessage = `${message}\n\n🔗 *Link de reunión:*\n${calendarEvent.hangoutLink}`;
    } else if (calendarEvent?.conferenceData?.entryPoints) {
      const videoEntry = calendarEvent.conferenceData.entryPoints.find(
        entry => entry.entryPointType === "video"
      );
      if (videoEntry?.uri) {
        finalMessage = `${message}\n\n🔗 *Link de reunión:*\n${videoEntry.uri}`;
      }
    }

    const sentMessage = await SendWhatsAppMessage({
      body: finalMessage,
      ticket: ticket
    });

    // Guardar el mensaje en la base de datos y emitir eventos al frontend
    await verifyMessage({
      msg: sentMessage,
      ticket: ticket,
      contact: ticket.contact,
      skipUnreadReset: true
    });

    console.log("[SendMessageToTicketService] ✅ Mensaje guardado en BD y emitido al frontend");

    return {
      success: true,
      data: {
        ticketId: ticket.id,
        messageId: sentMessage.id._serialized,
        groupName: ticket.contact?.name || "Unknown",
        sentAt: new Date()
      }
    };

  } catch (error) {
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: `Error al enviar mensaje: ${error.message}`
    };
  }
};

export default SendMessageToTicketService;
