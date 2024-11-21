import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
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
    wasSentToZapier
  } = ticketData;

  const ticket = await ShowTicketService(ticketId, true);
  // await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
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
    ...(wasSentToZapier && { wasSentToZapier })
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
    /* io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    }); */
    // Define la URL a la que se va a enviar la solicitud
    const url = process.env.NODE_URL + "/toEmit";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: [oldStatus],
        event: {
          name: "ticket",
          data: {
            action: "delete",
            ticketId: ticket.id
          }
        }
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok " + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        console.log("Success:", data);
      })
      .catch(error => {
        console.error("Error:", error);
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

  /* io.to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket
    }); */
  // Define la URL a la que se va a enviar la solicitud
  const url = process.env.NODE_URL + "/toEmit";
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: [ticket.status, "notification", ticketId.toString()],
      event: {
        name: "ticket",
        data: {
          action: "update",
          ticket
        }
      }
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      console.log("Success:", data);
    })
    .catch(error => {
      console.error("Error:", error);
    });

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;
