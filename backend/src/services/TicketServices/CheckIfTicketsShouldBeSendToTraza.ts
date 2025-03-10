import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

const CheckIfTicketsShouldBeSendToTraza = async (
  ids: number[]
): Promise<number[]> => {
  const tickets = await Ticket.findAll({
    attributes: ["id", "wasSentToZapier"],
    include: [
      {
        model: Message,
        as: "messages",
        required: false
      }
    ],
    where: {
      id: {
        [Op.in]: ids
      }
    }
  });

  const result = tickets.reduce((acc, ticket) => {
    if (!ticket.wasSentToZapier) {
      const messagesFromClient = ticket.messages.filter(m => !m.fromMe);
      const messagesFromConection = ticket.messages.filter(m => m.fromMe);

      if (messagesFromClient.length > 5 && messagesFromConection.length > 5) {
        acc.push(ticket.id);
      }
    }

    return acc;
  }, []);

  return result;
};

export default CheckIfTicketsShouldBeSendToTraza;
