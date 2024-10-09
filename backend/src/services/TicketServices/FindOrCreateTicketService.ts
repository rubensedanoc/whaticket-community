import * as Sentry from "@sentry/node";
import { subHours, subMinutes } from "date-fns";
import { Op } from "sequelize";
import Category from "../../models/Category";
import ChatbotMessage from "../../models/ChatbotMessage";
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
  chatbotMessageIdentifier?: string
): Promise<Ticket> => {
  let ticket = await findTicket(
    contact,
    whatsappId,
    unreadMessages,
    groupContact,
    lastMessageTimestamp,
    chatbotMessageIdentifier
  );

  // if ticket not exists, create a ticket from the contact or groupContact, with status pending, isGroup prop,
  // unreadMessages and from the whatsappId
  if (!ticket) {
    try {
      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status: chatbotMessageIdentifier
          ? "closed"
          : !!groupContact
          ? "open"
          : "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId,
        lastMessageTimestamp,
        ...(chatbotMessageIdentifier && {
          chatbotMessageIdentifier
        })
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
          status: chatbotMessageIdentifier
            ? "closed"
            : !!groupContact
            ? "open"
            : "pending",
          isGroup: !!groupContact,
          unreadMessages,
          whatsappId,
          lastMessageTimestamp,
          ...(chatbotMessageIdentifier && {
            chatbotMessageIdentifier
          })
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
  chatbotMessageIdentifier?: string
) => {
  // find a ticket with status open or pending, from the contact or groupContact and  from the whatsappId
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsappId
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
      }),
      ...(chatbotMessageIdentifier && {
        chatbotMessageIdentifier
      })
    });
  }

  // if ticket not exists and groupContact is trully, find a ticket from the groupContact and from the whatsappId
  // if this time the ticket exists, update his status to pending and set his userId to null and update his unreadMessages
  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
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
  if (!ticket && !groupContact && !chatbotMessageIdentifier) {
    console.log("xxx Buscamos ticket antiguo con el contacto");

    // bsucamos el ultimo ticket asi sean no interactivos
    ticket = await Ticket.findOne({
      where: {
        // updatedAt: {
        //   [Op.between]: [+subHours(new Date(), 2), +new Date()]
        // },
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

    if (ticket) {
      console.log("xxx Ticket antiguo encontrado");

      const twoHoursAgo = subHours(new Date(), 2);
      let validTime = twoHoursAgo;

      if (ticket.chatbotMessageIdentifier && !ticket.userId) {
        console.log(
          "xxx Ticket antiguo tiene chatbotMessageIdentifier y no ha tenido usuario"
        );

        const chatbotMessage = await ChatbotMessage.findOne({
          where: {
            identifier: ticket.chatbotMessageIdentifier,
            isActive: true,
            wasDeleted: false
          }
        });

        if (chatbotMessage && chatbotMessage.timeToWaitInMinutes) {
          console.log(
            "xxx ChatbotMessage del ticlet antiguo tiene timeToWaitInMinutes " +
              chatbotMessage.timeToWaitInMinutes
          );

          validTime = subMinutes(
            new Date(),
            chatbotMessage.timeToWaitInMinutes
          );
        } else {
          console.log(
            "xxx ChatbotMessage del ticlet antiguo no tiene timeToWaitInMinutes  se va a usar el validTime de 2 horas"
          );
        }
      } else {
        console.log(
          "xxx Ticket antiguo no tiene chatbotMessageIdentifier o ya ha tenido usuario se va a usar el validTime de 2 horas"
        );
      }

      console.log("xxx validTime", validTime);

      if (new Date(ticket.updatedAt) < validTime) {
        console.log(
          "xxx Ticket antiguo es no valido y se va a ignorar para crear uno nuevo"
        );

        ticket = null;
      } else {
        console.log("xxx Ticket antiguo es valido");
      }
    }

    if (ticket) {
      await ticket.update({
        status: !ticket.userId ? "pending" : "open",
        // userId: null,
        unreadMessages,
        ...(lastMessageTimestamp > ticket.lastMessageTimestamp && {
          lastMessageTimestamp
        }),
        ...(chatbotMessageIdentifier && {
          chatbotMessageIdentifier
        })
      });
    }
  }

  return ticket;
};

export default FindOrCreateTicketService;
