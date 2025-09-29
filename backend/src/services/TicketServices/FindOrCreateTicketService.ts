import * as Sentry from "@sentry/node";
import { subHours, subMinutes } from "date-fns";
import { Op } from "sequelize";
import Category from "../../models/Category";
import ChatbotMessage from "../../models/ChatbotMessage";
import ChatbotOption from "../../models/ChatbotOption";
import Contact from "../../models/Contact";
import MarketingCampaign from "../../models/MarketingCampaign";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import User from "../../models/User";
import { emitEvent } from "../../libs/emitEvent";

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
const FindOrCreateTicketService = async (props: {
  contact: Contact;
  whatsappId: number;
  unreadMessages: number;
  groupContact?: Contact;
  lastMessageTimestamp?: number;
  chatbotMessageIdentifier?: string;
  messagingCampaignId?: number;
  messagingCampaignShipmentId?: number;
  marketingMessagingCampaignShipmentId?: number;
  marketingMessagingCampaignId?: number;
  marketingCampaignId?: number;
  msgFromMe?: boolean;
  userId?: number;
  categoriesIds?: number[];
}): Promise<Ticket> => {
  const {
    contact,
    whatsappId,
    unreadMessages,
    groupContact,
    lastMessageTimestamp,
    chatbotMessageIdentifier,
    messagingCampaignId,
    messagingCampaignShipmentId,
    marketingMessagingCampaignShipmentId,
    marketingMessagingCampaignId,
    marketingCampaignId,
    userId,
    categoriesIds
  } = props;

  let ticket = await findTicket(props);

  // if ticket not exists, create a ticket from the contact or groupContact, with status pending, isGroup prop,
  // unreadMessages and from the whatsappId
  if (!ticket) {
    try {
      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status:
          chatbotMessageIdentifier ||
          messagingCampaignId ||
          marketingMessagingCampaignId
            ? "closed"
            : !!groupContact || userId
            ? "open"
            : "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId,
        lastMessageTimestamp,
        ...(chatbotMessageIdentifier && {
          chatbotMessageIdentifier
        }),
        ...(messagingCampaignId && {
          messagingCampaignId
        }),
        ...(messagingCampaignShipmentId && {
          messagingCampaignShipmentId
        }),
        ...(marketingMessagingCampaignShipmentId && {
          marketingMessagingCampaignShipmentId
        }),
        ...(marketingMessagingCampaignId && {
          marketingMessagingCampaignId
        }),
        ...(marketingCampaignId && {
          marketingCampaignId
        }),
        ...(userId && {
          userId
        })
      });

      if (categoriesIds) {
        await ticket.$set("categories", categoriesIds);
      }

      // find the ticket from the service ShowTicketService and return it
      ticket = await ShowTicketService(ticket.id);
    } catch (error) {
      console.log("--- Error en FindOrCreateTicketService", error);

      // Esperar 200 ms antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log("--- Reintentando otra vez vez");

      Sentry.captureException(error);

      ticket = await findTicket(props);

      if (!ticket) {
        ticket = await Ticket.create({
          contactId: groupContact ? groupContact.id : contact.id,
          status:
            chatbotMessageIdentifier ||
            messagingCampaignId ||
            marketingMessagingCampaignId
              ? "closed"
              : !!groupContact || userId
              ? "open"
              : "pending",
          isGroup: !!groupContact,
          unreadMessages,
          whatsappId,
          lastMessageTimestamp,
          ...(chatbotMessageIdentifier && {
            chatbotMessageIdentifier
          }),
          ...(messagingCampaignId && {
            messagingCampaignId
          }),
          ...(messagingCampaignShipmentId && {
            messagingCampaignShipmentId
          }),
          ...(marketingMessagingCampaignShipmentId && {
            marketingMessagingCampaignShipmentId
          }),
          ...(marketingMessagingCampaignId && {
            marketingMessagingCampaignId
          }),
          ...(marketingCampaignId && {
            marketingCampaignId
          }),
          ...(userId && {
            userId
          })
        });

        if (categoriesIds) {
          await ticket.$set("categories", categoriesIds);
        }
      }

      // find the ticket from the service ShowTicketService and return it
      ticket = await ShowTicketService(ticket.id);
    }
  }

  return ticket;
};

const findTicket = async ({
  contact,
  whatsappId,
  unreadMessages,
  groupContact,
  lastMessageTimestamp,
  chatbotMessageIdentifier,
  messagingCampaignId,
  messagingCampaignShipmentId,
  marketingMessagingCampaignShipmentId,
  marketingMessagingCampaignId,
  marketingCampaignId,
  msgFromMe,
  userId,
  categoriesIds
}: {
  contact: Contact;
  whatsappId: number;
  unreadMessages: number;
  groupContact?: Contact;
  lastMessageTimestamp?: number;
  chatbotMessageIdentifier?: string;
  messagingCampaignId?: number;
  messagingCampaignShipmentId?: number;
  marketingMessagingCampaignShipmentId?: number;
  marketingMessagingCampaignId?: number;
  marketingCampaignId?: number;
  msgFromMe?: boolean;
  userId?: number;
  categoriesIds?: number[];
}) => {
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
            model: MarketingCampaign,
            as: "marketingCampaigns",
            required: false
          },
          {
            model: ChatbotOption,
            as: "chatbotOptions",
            where: {
              fatherChatbotOptionId: null
            },
            required: false
          }
        ]
      },
      {
        model: User,
        as: "participantUsers",
        required: false
      },
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
      }),
      ...(messagingCampaignId && {
        messagingCampaignId
      }),
      ...(messagingCampaignShipmentId && {
        messagingCampaignShipmentId
      }),
      ...(marketingMessagingCampaignShipmentId && {
        marketingMessagingCampaignShipmentId
      }),
      ...(marketingMessagingCampaignId && {
        marketingMessagingCampaignId
      }),
      ...(marketingCampaignId && {
        marketingCampaignId
      }),
      ...(userId && {
        userId
      })
    });

    if (categoriesIds) {
      await ticket.$set("categories", categoriesIds);
    }
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
        },
        {
          model: User,
          as: "participantUsers",
          required: false
        },
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

    if (
      ticket &&
      (messagingCampaignShipmentId || marketingMessagingCampaignShipmentId) &&
      !ticket.messagingCampaignShipmentId &&
      !ticket.marketingMessagingCampaignShipmentId
    ) {
      ticket = null;
    }

    if (
      ticket &&
      (messagingCampaignShipmentId || marketingMessagingCampaignShipmentId) &&
      (ticket.messagingCampaignShipmentId ||
        ticket.marketingMessagingCampaignShipmentId) &&
      ticket.messagingCampaignShipmentId !== messagingCampaignShipmentId &&
      ticket.marketingMessagingCampaignShipmentId !==
        marketingMessagingCampaignShipmentId
    ) {
      ticket = null;
    }

    if (
      ticket &&
      !ticket.messagingCampaignId &&
      !ticket.marketingMessagingCampaignId
    ) {
      const twoHoursAgo = subHours(new Date(), 2);
      const fiveMinutesAgo = subMinutes(new Date(), 5);

      let validTime = twoHoursAgo;

      // si no estamos en la app comercial
      if (process.env.APP_PURPOSE !== "comercial") {
        // validamos si es el area de soporte tecnico
        if (ticket.queueId && ticket.queueId === 10) {
          // bajamos el valid time a 5 minutos
          validTime = fiveMinutesAgo;
        }
      }

      if (ticket.chatbotMessageIdentifier && !ticket.userId) {
        const chatbotMessage = await ChatbotMessage.findOne({
          where: {
            identifier: ticket.chatbotMessageIdentifier,
            isActive: true,
            wasDeleted: false
          }
        });

        if (chatbotMessage && chatbotMessage.timeToWaitInMinutes) {
          validTime = subMinutes(
            new Date(),
            chatbotMessage.timeToWaitInMinutes
          );
        }
      } else {
        console.log(
          "xxx Ticket antiguo no tiene chatbotMessageIdentifier o ya ha tenido usuario se va a usar el validTime de 2 horas"
        );
      }

      if (new Date(ticket.updatedAt) < validTime) {
        ticket = null;
      }
    }

    if (ticket) {
      const oldStatus = ticket.status;

      await ticket.update({
        status:
          (!ticket.messagingCampaignId &&
            !ticket.marketingMessagingCampaignId) ||
          !msgFromMe
            ? !ticket.userId
              ? "pending"
              : "open"
            : undefined,
        // userId: null,
        unreadMessages,
        ...(lastMessageTimestamp > ticket.lastMessageTimestamp && {
          lastMessageTimestamp
        }),
        ...(chatbotMessageIdentifier && {
          chatbotMessageIdentifier
        }),
        ...(messagingCampaignId && {
          messagingCampaignId
        }),
        ...(messagingCampaignShipmentId && {
          messagingCampaignShipmentId
        }),
        ...(marketingMessagingCampaignShipmentId && {
          marketingMessagingCampaignShipmentId
        }),
        ...(marketingMessagingCampaignId && {
          marketingMessagingCampaignId
        }),
        ...(marketingCampaignId && {
          marketingCampaignId
        }),
        ...(userId && {
          userId
        })
      });

      if (categoriesIds) {
        await ticket.$set("categories", categoriesIds);
      }

      // si el ticket pasa de closed a open, se emitira un evento de delete para el status closed
      if (ticket.status === "open" && oldStatus === "closed") {
        emitEvent({
          to: [oldStatus],
          event: {
            name: "ticket",
            data: {
              action: "delete",
              ticketId: ticket.id
            }
          }
        });
      }
    }
  }

  return ticket;
};

export default FindOrCreateTicketService;
