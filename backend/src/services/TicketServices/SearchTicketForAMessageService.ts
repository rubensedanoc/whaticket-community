import WAWebJS from "whatsapp-web.js";
import Category from "../../models/Category";
import ChatbotOption from "../../models/ChatbotOption";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";

const SearchTicketForAMessageService = async (props: {
  contactId: number;
  whatsappId: number;
  message: WAWebJS.Message;
}): Promise<Ticket> => {
  const { contactId, whatsappId, message } = props;

  let posibleTickets = await Ticket.findAll({
    where: {
      contactId,
      whatsappId
    },
    include: [
      {
        model: Category,
        as: "categories",
        attributes: ["id"],
        required: false
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"],
        include: [
          {
            model: ChatbotOption,
            as: "chatbotOptions",
            where: {
              fatherChatbotOptionId: null
            },
            required: false
          }
        ],
        required: false
      },
      {
        model: Message,
        as: "messages",
        attributes: ["id", "timestamp"],
        separate: true,
        order: [["timestamp", "DESC"]],
        where: {
          isPrivate: false
        },
        required: false
      }
    ]
  });

  let ticketForTheMessage: Ticket | null = null;

  for (const posibleTicket of posibleTickets) {
    const firstMessage = posibleTicket.messages?.[0];
    const lastMessage =
      posibleTicket.messages?.[posibleTicket.messages.length - 1];

    // check if the messages is between the last message and the first message of the ticket
    if (
      firstMessage?.timestamp < message.timestamp &&
      lastMessage?.timestamp > message.timestamp
    ) {
      ticketForTheMessage = posibleTicket;
      break;
    }
  }

  return ticketForTheMessage;
};

export default SearchTicketForAMessageService;
