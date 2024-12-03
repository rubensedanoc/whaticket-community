import { emitEvent } from "../libs/emitEvent";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  console.log("--- SetTicketMessagesAsRead ticketId:", ticket.id);

  await Message.update(
    { read: true },
    {
      where: {
        ticketId: ticket.id,
        read: false
      }
    }
  );

  await ticket.update({ unreadMessages: 0 });

  try {
    const wbot = await GetTicketWbot(ticket);
    await wbot.sendSeen(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`
    );
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }

  emitEvent({
    to: [ticket.status],
    event: {
      name: "ticket",
      data: {
        action: "updateUnread",
        ticketId: ticket.id
      }
    }
  });
};

export default SetTicketMessagesAsRead;
