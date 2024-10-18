import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Category from "../../models/Category";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import ShowContactService from "../ContactServices/ShowContactService";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  queueId?: number;
  whatsappId?: number;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  whatsappId
}: Request): Promise<Ticket> => {
  let whatsappToUse: Whatsapp | null = null;

  if (whatsappId) {
    whatsappToUse = await Whatsapp.findByPk(whatsappId);

    if (!whatsappToUse) {
      throw new AppError("ERR_SEARCHING_WHATSAPP");
    }
  } else {
    whatsappToUse = await GetDefaultWhatsApp(userId);
  }

  await CheckContactOpenTickets(contactId, whatsappToUse.id);

  const { isGroup } = await ShowContactService(contactId);

  if (queueId === undefined) {
    const whatsappToUseWithQueues = await Whatsapp.findByPk(whatsappToUse.id, {
      include: [
        {
          model: Queue,
          as: "queues",
          required: false
        }
      ]
    });

    if (
      whatsappToUseWithQueues.queues &&
      whatsappToUseWithQueues.queues.length > 0
    ) {
      queueId = whatsappToUseWithQueues.queues[0].id;
    }
  }

  const { id }: Ticket = await whatsappToUse.$create("ticket", {
    contactId,
    status,
    isGroup,
    userId,
    queueId
  });

  const ticket = await Ticket.findByPk(id, {
    include: [
      "contact",
      {
        model: Category,
        as: "categories",
        attributes: ["id", "name", "color"],
        required: false
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  return ticket;
};

export default CreateTicketService;
