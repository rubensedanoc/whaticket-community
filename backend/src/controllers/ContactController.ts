import { Request, Response } from "express";
import * as Yup from "yup";

import CreateContactService from "../services/ContactServices/CreateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import ListContactsService from "../services/ContactServices/ListContactsService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";

import { Op } from "sequelize";
import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";
import { getWbot, getWbots } from "../libs/wbot";
import Category from "../models/Category";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Queue from "../models/Queue";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import GetContactService from "../services/ContactServices/GetContactService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import { getClientTimeWaitingForTickets } from "./ReportsController";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
  checkIsAValidWppNumber?: boolean;
};

interface ExtraInfo {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  domain?: string;
  extraInfo?: ExtraInfo[];
  countryId?: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber
  });

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number, checkIsAValidWppNumber } =
    req.body as IndexGetContactQuery;

  const contact = await GetContactService({
    name,
    number,
    checkIsAValidWppNumber
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  newContact.number = newContact.number.replace(/[-+ ]/g, "");

  console.log("newContact", newContact);

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await CheckIsValidContact(newContact.number);
  const validNumber: any = await CheckContactNumber(newContact.number);

  const profilePicUrl = await GetProfilePicUrl(validNumber);

  let name = newContact.name;
  let number = validNumber;
  let email = newContact.email;
  let extraInfo = newContact.extraInfo;
  let countryId = newContact.countryId;

  const contact = await CreateContactService({
    name,
    number,
    email,
    extraInfo,
    profilePicUrl,
    countryId
  });

  emitEvent({
    event: {
      name: "contact",
      data: {
        action: "create",
        contact
      }
    }
  });

  // const io = getIO();
  // io.emit("contact", {
  //   action: "create",
  //   contact
  // });

  return res.status(200).json(contact);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;

  const contact = await ShowContactService(contactId);

  return res.status(200).json(contact);
};

export const showWithActualTicketIds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  const contact = await Contact.findByPk(contactId, {
    include: [
      "extraInfo",
      {
        model: Ticket,
        as: "tickets",
        required: false,
        attributes: ["id"],
        where: { status: { [Op.not]: "closed" } }
      }
    ]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return res.status(200).json(contact);
};

export const getContactTicketSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId, onlyIds } = req.body;

  const contact = await Contact.findByPk(contactId, {
    include: [
      {
        model: Ticket,
        as: "tickets",
        ...(onlyIds && {
          attributes: ["id", "whatsappId"]
        }),
        required: false,
        include: [
          {
            model: Message,
            as: "messages",
            required: false,
            attributes: ["id", "body", "timestamp"],
            order: [["timestamp", "DESC"]],
            limit: 1
            // separate: true
          }
        ]
      }
    ]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  // Solo mostrar los ultimos tickets del contacto con el mismo whatsappId
  let ticketsFilteredAndSorted = contact.tickets.reduce(
    (result: Ticket[], ticket) => {
      const relatedTicketIndexToReplace = result.findIndex(
        rt =>
          rt.whatsappId === ticket.whatsappId &&
          rt.messages?.[0]?.timestamp < ticket.messages?.[0]?.timestamp
      );

      if (relatedTicketIndexToReplace > -1) {
        result[relatedTicketIndexToReplace] = ticket;
      } else if (!result.find(rt => rt.whatsappId === ticket.whatsappId)) {
        result.push(ticket);
      }

      return result;
    },
    []
  );

  // ordenar desc por id
  ticketsFilteredAndSorted.sort((a, b) => {
    return b.id - a.id;
  });

  return res.status(200).json(ticketsFilteredAndSorted);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string()
    // number: Yup.string().matches(
    //   /^\d+$/,
    //   "Invalid number format. Only numbers is allowed."
    // )
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // await CheckIsValidContact(contactData.number);

  const { contactId } = req.params;

  const contact = await UpdateContactService({ contactData, contactId });

  // if (contact) {
  //   const exclusiveContactsNumbers = await searchIfNumbersAreExclusive({
  //     numbers: [+contact.number].filter(n => n)
  //   });

  //   for (const number in exclusiveContactsNumbers) {
  //     if (contact.number === number) {
  //       contact.isExclusive = true;
  //     }
  //   }
  // }

  emitEvent({
    event: {
      name: "contact",
      data: {
        action: "update",
        contact
      }
    }
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  await DeleteContactService(contactId);

  emitEvent({
    event: {
      name: "contact",
      data: {
        action: "delete",
        contactId
      }
    }
  });

  // const io = getIO();
  // io.emit("contact", {
  //   action: "delete",
  //   contactId
  // });

  return res.status(200).json({ message: "Contact deleted" });
};

export const getNumberGroups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { number } = req.params;

  console.log("____number", number);

  const numberConnection = await Whatsapp.findOne({ where: { number } });

  const registerGroups = [];
  const notRegisterGroups = [];

  if (numberConnection) {
    console.log("____number is connection");

    const wbot = getWbot(numberConnection.id);

    const wbotChats = await wbot.getChats();

    const wbotGroupChats = wbotChats.filter(chat => chat.isGroup);

    console.log("connectionGorupsChats", wbotGroupChats.length);

    await Promise.all(
      wbotGroupChats.map(async chat => {
        const wbotChatInOurDb = await Contact.findOne({
          where: { number: chat.id.user },
          include: [
            {
              model: Ticket,
              as: "tickets",
              required: false,
              include: [
                {
                  model: Contact,
                  as: "contact",
                  attributes: [
                    "id",
                    "name",
                    "number",
                    "domain",
                    "profilePicUrl",
                    "isCompanyMember"
                  ]
                },
                {
                  model: User,
                  as: "user",
                  required: false
                },
                {
                  model: Queue,
                  as: "queue",
                  attributes: ["id", "name", "color"],
                  required: false
                },
                {
                  model: Whatsapp,
                  as: "whatsapp",
                  attributes: ["name"],
                  required: false,
                  include: [
                    {
                      model: User,
                      attributes: ["id"],
                      as: "userWhatsapps",
                      required: false
                    }
                  ]
                },
                {
                  model: Category,
                  as: "categories",
                  attributes: ["id", "name", "color"]
                },

                {
                  model: User,
                  as: "helpUsers",
                  required: false
                },
                {
                  model: User,
                  as: "participantUsers",
                  required: false
                }
              ]
            }
          ]
        });

        if (wbotChatInOurDb) {
          // console.log("wbotChatInOurDb", wbotChatInOurDb.tickets);

          if (wbotChatInOurDb.tickets) {
            wbotChatInOurDb.tickets = await getClientTimeWaitingForTickets(
              wbotChatInOurDb.tickets
            );
          }

          registerGroups.push(wbotChatInOurDb);
        } else {
          notRegisterGroups.push(chat);
        }
      })
    );
  } else {
    console.log("____number is not connection");

    const wbots = getWbots();

    await Promise.all(
      wbots.map(async wbot => {
        const wbotstate = await wbot.getState();

        if (wbotstate === "CONNECTED") {
          console.log("wbot.id", wbot.id);
          console.log("wbot.info", wbot.info);

          console.log("wbotstate", wbotstate);

          try {
            const wbotChatsIds = await wbot.getCommonGroups(number + "@c.us");

            // const wbotGroupChats = wbotChats.filter(chat => chat.isGroup);

            console.log("wbotChatsIds", wbotChatsIds.length);

            await Promise.all(
              wbotChatsIds.map(async chat => {
                const wbotChatInOurDb = await Contact.findOne({
                  where: { number: chat.user },
                  include: [
                    {
                      model: Ticket,
                      as: "tickets",
                      required: false,
                      include: [
                        {
                          model: Contact,
                          as: "contact",
                          attributes: [
                            "id",
                            "name",
                            "number",
                            "domain",
                            "profilePicUrl",
                            "isCompanyMember"
                          ]
                        },
                        {
                          model: User,
                          as: "user",
                          required: false
                        },
                        {
                          model: Queue,
                          as: "queue",
                          attributes: ["id", "name", "color"],
                          required: false
                        },
                        {
                          model: Whatsapp,
                          as: "whatsapp",
                          attributes: ["name"],
                          required: false,
                          include: [
                            {
                              model: User,
                              attributes: ["id"],
                              as: "userWhatsapps",
                              required: false
                            }
                          ]
                        },
                        {
                          model: Category,
                          as: "categories",
                          attributes: ["id", "name", "color"]
                        },

                        {
                          model: User,
                          as: "helpUsers",
                          required: false
                        },
                        {
                          model: User,
                          as: "participantUsers",
                          required: false
                        }
                      ]
                    }
                  ]
                });

                if (wbotChatInOurDb) {
                  // console.log("wbotChatInOurDb", wbotChatInOurDb.tickets);

                  // if (wbotChatInOurDb.tickets) {
                  //   wbotChatInOurDb.tickets =
                  //     await getClientTimeWaitingForTickets(
                  //       wbotChatInOurDb.tickets
                  //     );
                  // }
                  registerGroups.push(wbotChatInOurDb);
                } else {
                  notRegisterGroups.push(chat);
                }
              })
            );
          } catch (error) {
            console.log("error", error);
          }
        }
      })
    );
  }

  console.log(
    "registerGroups",
    registerGroups.length
    // registerGroups.map(r => r)
  );
  console.log("notRegisterGroups", notRegisterGroups.length);

  return res.status(200).json({ registerGroups, notRegisterGroups });
};
