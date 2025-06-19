import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import { emitEvent } from "../../libs/emitEvent";
import Ticket from "../../models/Ticket";
import TicketCategory from "../../models/TicketCategory";
import ShowTicketService from "./ShowTicketService";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
  privateNote?: string;
  categoriesIds?: number[];
  helpUsersIds?: number[];
  participantUsersIds?: number[];
  transferred?: boolean;
  categorizedByAI?: boolean;
  marketingCampaignId?: number;
  wasSentToZapier?: boolean;
  beenWaitingSinceTimestamp?: number | null;
  lastMessage?: string;
  updateSiblingsCategories?: boolean;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId
}: Request): Promise<Response> => {
  let {
    status,
    userId,
    queueId,
    whatsappId,
    privateNote,
    categoriesIds,
    helpUsersIds,
    participantUsersIds,
    transferred,
    categorizedByAI,
    marketingCampaignId,
    wasSentToZapier,
    beenWaitingSinceTimestamp,
    lastMessage,
    updateSiblingsCategories = false
  } = ticketData;

  const ticket = await ShowTicketService(ticketId, true);
  // await SetTicketMessagesAsRead(ticket);

  if (status && status === 'open' && ticket.status === 'open') {
    throw new AppError("ERR_TICKET_ALREADY_OPEN");
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  // console.log(
  //   "se le asignara defaultTicketCategoryId:",
  //   oldStatus === "pending",
  //   status === "open",
  //   !ticket.categories?.length,
  //   !categoriesIds?.length,
  //   ticket.queue?.defaultTicketCategoryId
  // );

  if (
    oldStatus === "pending" &&
    status === "open" &&
    !ticket.categories?.length &&
    !categoriesIds?.length &&
    ticket.queue?.defaultTicketCategoryId
  ) {
    categoriesIds = [ticket.queue?.defaultTicketCategoryId];
  }

  await ticket.update({
    status,
    queueId,
    userId,
    privateNote,
    ...(transferred === true && { transferred }),
    ...(categorizedByAI === true && { categorizedByAI }),
    marketingCampaignId,
    ...(wasSentToZapier && { wasSentToZapier }),
    beenWaitingSinceTimestamp,
    lastMessage
  });

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  if (categoriesIds) {
    await ticket.$set("categories", categoriesIds);

    if (categorizedByAI) {
      for (const categoryId of categoriesIds) {
        await TicketCategory.update(
          { byAI: true },
          {
            where: {
              ticketId: ticket.id,
              categoryId: categoryId
            }
          }
        );
      }
    }

    if (ticket.isGroup && updateSiblingsCategories) {
      console.log("--- ticket a actualizar es grupo --- ", ticket.contact);

      const relatedTickets = await Ticket.findAll({
        attributes: ["id"],
        where: {
          contactId: ticket.contactId,
          status: {
            [Op.in]: ["open", "pending"]
          },
          id: {
            [Op.ne]: ticket.id
          }
        }
      });

      console.log("--- ticket tiene relatedTickets ---", relatedTickets.length);

      if (relatedTickets.length) {
        for (const relatedTicket of relatedTickets) {
          const relatedTicketWithData = await ShowTicketService(
            relatedTicket.id,
            true
          );
          await relatedTicketWithData.$set("categories", categoriesIds);
          await relatedTicketWithData.reload();

          if (relatedTicketWithData.messages?.length > 0) {
            relatedTicketWithData.messages?.sort(
              (a, b) => a.timestamp - b.timestamp
            );
          }

          emitEvent({
            to: [
              relatedTicketWithData.status,
              "notification",
              relatedTicketWithData.id.toString()
            ],
            event: {
              name: "ticket",
              data: {
                action: "update",
                ticket: relatedTicketWithData
              }
            }
          });
        }
      }
    }
  }

  if (helpUsersIds) {
    await ticket.$set("helpUsers", helpUsersIds);
  }

  if (participantUsersIds) {
    console.log(
      "se quiere actualizar los participantUsersIds con : ",
      participantUsersIds
    );

    await ticket.$set("participantUsers", participantUsersIds);
  }

  await ticket.reload();

  if (ticket.messages?.length > 0) {
    ticket.messages?.sort((a, b) => a.timestamp - b.timestamp);
  }

  // const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
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

  // if (ticket.contact) {
  //   const exclusiveContactsNumbers = await searchIfNumbersAreExclusive({
  //     numbers: [ticket].map(ticket => +ticket.contact.number).filter(n => n)
  //   });

  //   for (const number in exclusiveContactsNumbers) {
  //     if (ticket.contact.number === number) {
  //       ticket.contact.isExclusive = true;
  //     }
  //   }
  // }

  emitEvent({
    to: [ticket.status, "notification", ticketId.toString()],
    event: {
      name: "ticket",
      data: {
        action: "update",
        ticket
      }
    }
  });

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;
