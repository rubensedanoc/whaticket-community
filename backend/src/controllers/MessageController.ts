import { Request, Response } from "express";

import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";

// import ListMessages2Service from "../services/MessageServices/ListMessages2Service";
import { Op } from "sequelize";
import AppError from "../errors/AppError";
import GetWbotMessage from "../helpers/GetWbotMessage";
import { emitEvent } from "../libs/emitEvent";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ListMessagesV2Service from "../services/MessageServices/ListMessagesV2Service";
import ListConsolidatedMessagesService from "../services/MessageServices/ListConsolidatedMessagesService";
import SearchMessagesService from "../services/MessageServices/SearchMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import verifyPrivateMessage from "../utils/verifyPrivateMessage";

type searchQuery = {
  searchParam: string;
  pageNumber: string;
};

type IndexQuery = {
  pageNumber: string;
  setTicketMessagesAsRead?: string;
};

type IndexQueryV2 = {
  setTicketMessagesAsRead?: string;
  searchMessageId?: string;
  ticketsToFetchMessagesQueue: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  whatsappId?: number;
  contactId?: number;
};

export const search = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as unknown as searchQuery;

  const { count, messages, hasMore } = await SearchMessagesService({
    searchParam,
    pageNumber
  });

  return res.json({ count, messages, hasMore });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const { pageNumber, setTicketMessagesAsRead } =
    req.query as unknown as IndexQuery;

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId
  });

  if (setTicketMessagesAsRead === "true") {
    SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

/**
 * Endpoint para obtener mensajes consolidados de múltiples tickets del mismo contacto.
 * Se usa en la vista "Agrupados" cuando un grupo tiene múltiples conexiones.
 */
export const consolidatedIndex = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { pageNumber, setTicketMessagesAsRead } = req.query as unknown as IndexQuery;

  const { count, messages, tickets, hasMore } = await ListConsolidatedMessagesService({
    pageNumber,
    contactId
  });

  // Marcar como leídos todos los tickets del grupo si se solicita
  if (setTicketMessagesAsRead === "true" && tickets.length > 0) {
    // Marcar el ticket más reciente (primero en el array)
    SetTicketMessagesAsRead(tickets[0]);
  }

  return res.json({ count, messages, tickets, hasMore });
};

export const indexV2 = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // console.log("--- CALL FOR MessageController indexV2");

  const {
    setTicketMessagesAsRead,
    ticketsToFetchMessagesQueue,
    searchMessageId
  } = req.query as unknown as IndexQueryV2;

  // console.log("_________index2:", {
  //   setTicketMessagesAsRead,
  //   ticketsToFetchMessagesQueue
  // });

  const {
    messages,
    ticketsToFetchMessagesQueue: nextTicketsToFetchMessagesQueue,
    hasMore
  } = await ListMessagesV2Service({
    ticketsToFetchMessagesQueue,
    searchMessageId
  });

  if (setTicketMessagesAsRead === "true") {
    if (
      nextTicketsToFetchMessagesQueue[0].ticket &&
      typeof nextTicketsToFetchMessagesQueue[0].ticket.update === "function"
    ) {
      // console.log(
      //   "--- MessageController index2 SetTicketMessagesAsRead TICKET: ",
      //   nextTicketsToFetchMessagesQueue[0].ticket.id
      // );
      SetTicketMessagesAsRead(nextTicketsToFetchMessagesQueue[0].ticket);
    } else {
      // console.log(
      //   "--- MessageController index2 SetTicketMessagesAsRead TICKET: ",
      //   nextTicketsToFetchMessagesQueue[0].ticket.id,
      //   "WAS NOT POSSIBLE"
      // );
    }
  }

  return res.json({ messages, nextTicketsToFetchMessagesQueue, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  const ticket = await ShowTicketService(ticketId);

  SetTicketMessagesAsRead(ticket);

  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({ media, ticket });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket, quotedMsg });
  }

  ticket.update({ userHadContact: true });

  return res.send();
};

export const storePrivate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { body }: MessageData = req.body;

  const ticket = await ShowTicketService(ticketId);

  verifyPrivateMessage(body, ticket, ticket.contact);

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;

  const message = await DeleteWhatsAppMessage(messageId);

  emitEvent({
    to: [message.ticketId.toString()],
    event: {
      name: "appMessage",
      data: {
        action: "update",
        message
      }
    }
  });

  return res.send();
};

export const updateOnWpp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { body } = req.body;

  // console.log("--- updateOnWpp", messageId, body);

  try {
    const message = await Message.findByPk(messageId, {
      include: [
        {
          model: Ticket,
          as: "ticket",
          include: ["contact"]
        }
      ]
    });

    if (!message) {
      throw new AppError("No message found with this ID.");
    }

    const { ticket } = message;

    const messageToEdit = await GetWbotMessage(ticket, messageId);

    const editedMessage = await messageToEdit.edit(body);

    if (!editedMessage) {
      throw new AppError(
        "Se trato de editar un mensaje usando el .edit y no funciono"
      );
    }

    await message.update({ body: editedMessage.body, isEdited: true });

    emitEvent({
      to: [message.ticketId.toString()],
      event: {
        name: "appMessage",
        data: {
          action: "update",
          message
        }
      }
    });
  } catch (err) {
    throw new AppError("El mensaje no se pudo editar");
  }

  return res.send();
};

export const all = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, contactId }: MessageData = req.body;

  console.log("all", whatsappId, contactId);

  const allTickets = await Ticket.findAll({
    where: { whatsappId, contactId }
  });

  console.log("allTickets", allTickets);

  const ticketMessages = await Message.findAll({
    where: {
      ticketId: {
        [Op.in]: allTickets.map(ticket => ticket.id)
      }
    },
    order: [["timestamp", "ASC"]],
    include: [{ model: Contact, as: "contact", required: false }]
  });

  const allWhatsapps = await Whatsapp.findAll();

  const contact = await Contact.findByPk(contactId);

  return res.status(200).json({ ticketMessages, contact, allWhatsapps });
};
