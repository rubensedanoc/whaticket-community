import { Op } from "sequelize";
import { MessageId } from "whatsapp-web.js";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import { verifyMessage } from "../services/WbotServices/wbotMessageListener";

function generateRandomID(length: number) {
  const characters = "0123456789ABCDEF"; // caracteres posibles
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

export default async function verifyPrivateMessage(
  bodyMessage: string,
  ticket: Ticket,
  contact: Contact
) {
  const testMessageId: MessageId = {
    id: generateRandomID(20),
    fromMe: true,
    remote: "",
    _serialized: ""
  };

  const privateMessageTimestamp = Math.floor(Date.now() / 1000);

  // @ts-ignore
  const testMessage: WbotMessage = {
    id: testMessageId,
    fromMe: true,
    body: bodyMessage,
    timestamp: privateMessageTimestamp
  };

  verifyMessage({ msg: testMessage, ticket, contact, isPrivate: true });
  ticket.update({ lastMessageTimestamp: privateMessageTimestamp });

  if (ticket.isGroup) {
    const ticketBrothers = await Ticket.findAll({
      where: {
        contactId: ticket.contactId,
        isGroup: true,
        status: { [Op.not]: "closed" },
        id: { [Op.not]: ticket.id }
      }
    });

    for (const ticketBrother of ticketBrothers) {
      verifyMessage({
        msg: {
          ...testMessage,
          body: `${testMessage.body}\n\n(Escrito en el ticket: ${ticket.id})`
        },
        ticket: ticketBrother,
        contact,
        isPrivate: true
      });
      ticketBrother.update({ lastMessageTimestamp: privateMessageTimestamp });
    }
  }
}
