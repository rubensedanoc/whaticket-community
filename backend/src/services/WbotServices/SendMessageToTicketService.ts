import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../MessageServices/SendWhatsAppMessage";

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
