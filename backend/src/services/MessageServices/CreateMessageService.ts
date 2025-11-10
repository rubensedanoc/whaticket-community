import { v4 as uuidv4 } from "uuid";
import { emitEvent } from "../../libs/emitEvent";
import Category from "../../models/Category";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import getAndSetBeenWaitingSinceTimestampTicketService from "../TicketServices/getAndSetBeenWaitingSinceTimestampTicketService";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  isPrivate?: boolean;
  isDuplicated?: boolean;
}
interface Request {
  messageData: MessageData;
  ticket: Ticket;
}

const CreateMessageService = async ({
  messageData,
  ticket
}: Request): Promise<Message> => {
  // Guardar una copia del ID original
  const originalId = messageData.id;

  try {

    // Crear el mensaje
    await Message.create(messageData);

  } catch (error) {

    // Si la creacion del mensaje falla, esperar y reintentar
    // SOLO SI EL TICKET ES GRUPAL
    if (ticket?.isGroup) {

      // Esperar 200 ms antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verificar nuevamente con el ID original
      let messageAlreadyCreated2 = await Message.findByPk(originalId);

      if (messageAlreadyCreated2) {
        // Generar un nuevo ID y marcar como duplicado si ya existe
        messageData.id = uuidv4();
        messageData.isDuplicated = true;
      } else {
      }

      // Reintentar la creación del mensaje
      await Message.create(messageData);

    } else {
      throw new Error("ERR_CREATING_MESSAGE");
    }

  }

  // Recuperar el mensaje creado

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"],
            include: [
              {
                model: User,
                attributes: ["id"],
                as: "userWhatsapps",
                required: false
              }
            ]
          },
          {
            model: Category,
            as: "categories",
            attributes: ["id", "name", "color"],
            required: false
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "name"],
            required: false
          },
          {
            model: User,
            as: "helpUsers",
            required: false
          },
          {
            model: User,
            as: "participantUsers",
            required: false
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  // message.ticket.messages?.sort((a, b) => a.timestamp - b.timestamp);

  if (message.ticket) {
    // message.ticket = (
    //   await getClientTimeWaitingForTickets([message.ticket])
    // )[0];
    message.ticket = (await getAndSetBeenWaitingSinceTimestampTicketService(
      message.ticket
    )) as Ticket;
  }

  emitEvent({
    to: [message.ticketId.toString(), message.ticket.status, "notification"],
    event: {
      name: "appMessage",
      data: {
        action: "create",
        message,
        ticket: message.ticket,
        contact: message.ticket.contact
      }
    }
  });

  return message;
};

export default CreateMessageService;
