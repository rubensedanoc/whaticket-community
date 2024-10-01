import * as Sentry from "@sentry/node";
import { subHours } from "date-fns";
import { Op } from "sequelize";
import Category from "../../models/Category";
import ChatbotOption from "../../models/ChatbotOption";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

/**
 * search for a existing "open" or "pending" ticket from the contact or groupContact and whatsappId
 * if ticket exists, update his unreadMessages
 * if not exist a ticket with that status, search for any ticket from the groupContact and whatsappId (like "closed tickets")
 * - in case of exist a ticket from the groupContact, update his status to "pending", set his userId to null and update his unreadMessages
 * - in case on exist a ticket from the contact (updated in the last 2 hours), update his status to "pending", set his userId to null and update his unreadMessages
 * if finally any tickets is found, create a new ticket from the contact or groupContact, with status "pending", isGroup prop, unreadMessages and whatsappId
 *
 * at the end, find the ticket from the service ShowTicketService and return it
 */
const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact,
  lastMessageTimestamp?: number,
  type: string = "normal"
): Promise<Ticket> => {
  let ticket = await findTicket(
    contact,
    whatsappId,
    unreadMessages,
    groupContact,
    lastMessageTimestamp,
    type === "normal"
  );

  // if ticket not exists, create a ticket from the contact or groupContact, with status pending, isGroup prop,
  // unreadMessages and from the whatsappId
  if (!ticket) {
    try {
      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status:
          type === "non-interactive"
            ? "closed"
            : !!groupContact
            ? "open"
            : "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId,
        lastMessageTimestamp,
        type
      });

      // find the ticket from the service ShowTicketService and return it
      ticket = await ShowTicketService(ticket.id);
    } catch (error) {
      console.log("--- Error en FindOrCreateTicketService", error);

      // Esperar 200 ms antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log("--- Reintentando otra vez vez");

      Sentry.captureException(error);

      ticket = await findTicket(
        contact,
        whatsappId,
        unreadMessages,
        groupContact,
        lastMessageTimestamp
      );

      if (!ticket) {
        ticket = await Ticket.create({
          contactId: groupContact ? groupContact.id : contact.id,
          status:
            type === "non-interactive"
              ? "closed"
              : !!groupContact
              ? "open"
              : "pending",
          isGroup: !!groupContact,
          unreadMessages,
          whatsappId,
          lastMessageTimestamp,
          type
        });
      }

      // find the ticket from the service ShowTicketService and return it
      ticket = await ShowTicketService(ticket.id);
    }
  }

  return ticket;
};

const findTicket = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact,
  lastMessageTimestamp?: number,
  searchForClosedTickets: boolean = true
) => {
  // find a ticket with status open or pending, from the contact or groupContact and  from the whatsappId
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsappId,
      type: "normal"
    },
    include: [
      {
        model: Category,
        as: "categories",
        attributes: ["id"]
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
        ]
      }
    ]
  });

  // if ticket exists, update his unreadMessages
  if (ticket) {
    await ticket.update({
      unreadMessages,
      ...(lastMessageTimestamp > ticket.lastMessageTimestamp && {
        lastMessageTimestamp
      })
    });
  }

  if (searchForClosedTickets) {
    // if ticket not exists and groupContact is trully, find a ticket from the groupContact and from the whatsappId
    // if this time the ticket exists, update his status to pending and set his userId to null and update his unreadMessages
    if (!ticket && groupContact) {
      ticket = await Ticket.findOne({
        where: {
          contactId: groupContact.id,
          whatsappId: whatsappId,
          type: "normal"
        },
        include: [
          {
            model: Category,
            as: "categories",
            attributes: ["id"]
          }
        ],
        order: [["updatedAt", "DESC"]]
      });

      if (ticket) {
        await ticket.update({
          status: "open",
          // userId: null,
          unreadMessages,
          ...(lastMessageTimestamp > ticket.lastMessageTimestamp && {
            lastMessageTimestamp
          })
        });
      }
    }

    // if ticket not exists and groupContact is falsy, find a ticket updated in the last 2 hours from the contact and from the whatsappId
    // if this time the ticket exists, update his status to pending and set his userId to null and update his unreadMessages
    if (!ticket && !groupContact) {
      // bsucamos el ultimo ticket asi sean no interactivos
      ticket = await Ticket.findOne({
        where: {
          updatedAt: {
            [Op.between]: [+subHours(new Date(), 2), +new Date()]
          },
          contactId: contact.id,
          whatsappId: whatsappId
        },
        include: [
          {
            model: Category,
            as: "categories",
            attributes: ["id"]
          }
        ],
        order: [["updatedAt", "DESC"]]
      });

      // si el ultimo es interactivo, hacemos como que no lo encontramos
      // para crear uno nuevo que sea normal
      if (ticket?.type === "non-interactive") {
        ticket = null;
      }

      if (ticket) {
        await ticket.update({
          status: "open",
          // userId: null,
          unreadMessages,
          ...(lastMessageTimestamp > ticket.lastMessageTimestamp && {
            lastMessageTimestamp
          })
        });
      }
    }
  }

  return ticket;
};

export default FindOrCreateTicketService;
