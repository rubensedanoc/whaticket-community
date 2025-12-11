import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  contactId: string;
  pageNumber?: string;
}

interface Response {
  messages: any[];
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

/**
 * Servicio para obtener mensajes consolidados de múltiples tickets del mismo contacto (grupo).
 * Se usa en la vista "Agrupados" para mostrar todos los mensajes de un grupo
 * independientemente de por cuál conexión de WhatsApp llegaron.
 */
const ListConsolidatedMessagesService = async ({
  pageNumber = "1",
  contactId
}: Request): Promise<Response> => {
  // 1. Buscar todos los tickets del mismo contacto (grupo)
  const tickets = await Ticket.findAll({
    where: { 
      contactId: +contactId,
      isGroup: true 
    },
    include: [
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ]
  });

  if (!tickets || tickets.length === 0) {
    throw new AppError("ERR_NO_TICKETS_FOUND", 404);
  }

  const ticketIds = tickets.map(t => t.id);

  // 2. Configurar paginación
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // 3. Verificar si hay mensajes sin timestamp (chats antiguos)
  const sampleMessages = await Message.findAll({
    where: { ticketId: { [Op.in]: ticketIds } },
    attributes: ["id", "timestamp"],
    limit: 10
  });

  let orderProp = "timestamp";
  if (sampleMessages.find(msg => !msg.timestamp)) {
    orderProp = "createdAt";
  }

  // 4. Obtener mensajes de TODOS los tickets del grupo
  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId: { [Op.in]: ticketIds } },
    limit,
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      },
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "whatsappId"],
        include: [
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["id", "name"]
          }
        ]
      }
    ],
    offset,
    order: [[orderProp, "DESC"]]
  });

  // 5. Agregar información de conexión a cada mensaje
  const messagesWithConnectionInfo = messages.map(msg => {
    const messageObj = msg.get({ plain: true }) as any;
    return {
      ...messageObj,
      connectionInfo: {
        whatsappId: messageObj.ticket?.whatsappId,
        whatsappName: messageObj.ticket?.whatsapp?.name || "Sin nombre"
      }
    };
  });

  const hasMore = count > offset + messages.length;

  return {
    messages: messagesWithConnectionInfo.reverse(),
    tickets,
    count,
    hasMore
  };
};

export default ListConsolidatedMessagesService;
