import * as Sentry from "@sentry/node";
import { writeFile } from "fs";
import { join } from "path";
import { promisify } from "util";

import {
  Client,
  MessageAck,
  MessageMedia,
  MessageSendOptions,
  Contact as WbotContact,
  Message as WbotMessage
} from "whatsapp-web.js";

import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import { debounce } from "../../helpers/Debounce";
import formatBody from "../../helpers/Mustache";
import { getConnectedUsers } from "../../libs/connectedUsers";
import { emitEvent } from "../../libs/emitEvent";
import { getIO } from "../../libs/socket";
import ChatbotMessage from "../../models/ChatbotMessage";
import MarketingCampaign from "../../models/MarketingCampaign";
import MarketingCampaignAutomaticMessage from "../../models/MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaign from "../../models/MarketingMessagingCampaigns";
import MessagingCampaign from "../../models/MessagingCampaign";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import timeoutPromise from "../../utils/timeoutPromise";
import verifyPrivateMessage from "../../utils/verifyPrivateMessage";
import ShowChatbotOptionService from "../ChatbotOptionService/ShowChatbotOptionService";
import CreateContactService from "../ContactServices/CreateContactService";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import CreateTicketService from "../TicketServices/CreateTicketService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SearchTicketForAMessageService from "../TicketServices/SearchTicketForAMessageService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Notification from "../../models/Notification";
import { NOTIFICATIONTYPES } from "../../constants";
import Queue from "../../models/Queue";
import ShowTicketService from "../TicketServices/ShowTicketService";
import ShowNotificationService from "../NotificationService/ShowNotificationService";

interface Session extends Client {
  id?: number;
}

const writeFileAsync = promisify(writeFile);

/**
 * Save or update the contact in the database (name, number, profilePicUrl)
 */
export const verifyContact = async (
  msgContact: WbotContact
): Promise<Contact> => {
  const profilePicUrl = await timeoutPromise(
    msgContact.getProfilePicUrl(),
    200
  );

  const contactData: {
    name: string;
    number: string;
    profilePicUrl?: string;
    isGroup: boolean;
  } = {
    name: msgContact.name || msgContact.pushname || msgContact.id.user,
    number: msgContact.id.user,
    isGroup: msgContact.isGroup
  };

  if (profilePicUrl) {
    contactData.profilePicUrl = profilePicUrl;
  }

  const contact = CreateOrUpdateContactService(contactData);

  return contact;
};

const verifyContactForSyncUnreadMessages = async (
  msgContact: WbotContact
): Promise<Contact> => {
  const contactData: {
    name: string;
    number: string;
    profilePicUrl?: string;
    isGroup: boolean;
  } = {
    name: msgContact.name || msgContact.pushname || msgContact.id.user,
    number: msgContact.id.user,
    isGroup: msgContact.isGroup
  };

  const number = contactData.isGroup
    ? contactData.number
    : contactData.number.replace(/[^0-9]/g, "");

  let contact: Contact | null;

  contact = await Contact.findOne({ where: { number } });

  if (!contact) {
    contactData.profilePicUrl = await msgContact.getProfilePicUrl();

    contact = await Contact.create({
      name: contactData.name,
      number,
      profilePicUrl: contactData.profilePicUrl,
      isGroup: contactData.isGroup,
      email: "",
      extraInfo: []
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
  }

  // const contact = CreateOrUpdateContactService(contactData);

  return contact;
};

/**
 * Verify if the message has a quoted message and return it, otherwise return null
 */
const verifyQuotedMessage = async (
  msg: WbotMessage
): Promise<Message | null> => {
  if (!msg.hasQuotedMsg) return null;

  const wbotQuotedMsg = await msg.getQuotedMessage();

  const quotedMsg = await Message.findOne({
    where: { id: wbotQuotedMsg.id.id }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

/**
 * Generate random id string for file names, function got from: https://stackoverflow.com/a/1349426/1851801
 */
function makeRandomId(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

/**
 * Create a message in the database with the passed msg and update the ticket lastMessage
 * - download the media, and save it in the public folder
 */
export const verifyMediaMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact,
  updateTicketLastMessage = true,
  identifier = ""
): Promise<Message> => {
  const quotedMsg = await verifyQuotedMessage(msg);

  const media = await msg.downloadMedia();

  if (media) {
    let randomId = makeRandomId(5);

    if (!media.filename) {
      const ext = media.mimetype.split("/")[1].split(";")[0];
      media.filename = `${randomId}-${new Date().getTime()}.${ext}`;
    } else {
      media.filename =
        media.filename.split(".").slice(0, -1).join(".") +
        "." +
        randomId +
        "." +
        media.filename.split(".").slice(-1);
    }

    try {
      await writeFileAsync(
        join(__dirname, "..", "..", "..", "public", media.filename),
        media.data,
        "base64"
      );
    } catch (err) {
      Sentry.captureException(err);
      // @ts-ignore
      logger.error(err);
    }

    const messageData = {
      id: msg.id.id,
      ticketId: ticket.id,
      contactId: msg.fromMe ? undefined : contact.id,
      body: msg.body || media.filename,
      fromMe: msg.fromMe,
      read: msg.fromMe,
      mediaUrl: media.filename,
      mediaType: media.mimetype.split("/")[0],
      quotedMsgId: quotedMsg?.id,
      timestamp: msg.timestamp,
      ...(identifier && { identifier })
    };

    if (updateTicketLastMessage) {
      if ((ticket.lastMessageTimestamp || 0) <= msg.timestamp) {
        await ticket.update({ lastMessage: msg.body || media.filename });
      }
    }
    const newMessage = await CreateMessageService({ messageData, ticket });

    return newMessage;
  } else {
    const messageData = {
      id: msg.id.id,
      ticketId: ticket.id,
      contactId: msg.fromMe ? undefined : contact.id,
      body: msg.body
        ? "--- *No se pudo descargar el archivo* --- " + msg.body
        : "--- *No se pudo descargar el archivo* --- ",
      fromMe: msg.fromMe,
      read: msg.fromMe,
      mediaType: msg.type,
      quotedMsgId: quotedMsg?.id,
      timestamp: msg.timestamp,
      ...(identifier && { identifier })
    };

    if (updateTicketLastMessage) {
      if ((ticket.lastMessageTimestamp || 0) <= msg.timestamp) {
        await ticket.update({ lastMessage: messageData.body });
      }
    }

    const newMessage = await CreateMessageService({ messageData, ticket });

    return newMessage;
  }
};

/**
 * Create a message in the database with the passed msg and update the ticket lastMessage
 * - If the message is a location, prepare the message to include the location description and gmaps url
 */
export const verifyMessage = async ({
  msg,
  ticket,
  contact,
  isPrivate = false,
  updateTicketLastMessage = true,
  identifier = "",
  shouldUpdateUserHadContact = true
}: {
  msg: WbotMessage;
  ticket: Ticket;
  contact: Contact;
  isPrivate?: boolean;
  updateTicketLastMessage?: boolean;
  identifier?: string;
  shouldUpdateUserHadContact?: boolean;
}) => {
  if (msg.type === "location") msg = prepareLocation(msg);

  const quotedMsg = await verifyQuotedMessage(msg);

  const messageData = {
    id: msg.id.id,
    ticketId: ticket.id,
    contactId: msg.fromMe ? undefined : contact.id,
    body: msg.body,
    fromMe: msg.fromMe,
    mediaType: msg.type,
    read: msg.fromMe,
    quotedMsgId: quotedMsg?.id,
    isPrivate,
    timestamp: msg.timestamp,
    ...(identifier && { identifier })
  };

  if (updateTicketLastMessage) {

    // console.log(`--- verifyMessage - updateTicketLastMessage --- ${ticket.id} - ${msg.id.id} - ${ticket.lastMessageTimestamp} < ${msg.timestamp} - ${msg.body} `);

    // temporaryly disable ts checks because of type definition bug for Location object
    // @ts-ignore
    await ticket.update({
      ...((ticket.lastMessageTimestamp || 0) <= msg.timestamp && {
          lastMessage:
            msg.type === "location"
              ? // @ts-ignore
                msg.location.description
                ? // @ts-ignore
                  "Localization - " + msg.location.description.split("\\n")[0]
                : "Localization"
              : msg.body
      }),
      ...(msg.fromMe && !isPrivate && shouldUpdateUserHadContact && { userHadContact: true })
    });
  }

  return await CreateMessageService({ messageData, ticket });
};

/**
 * Modify the passed msg object to include the location description and gmaps url and return it
 */
const prepareLocation = (msg: WbotMessage): WbotMessage => {
  let gmapsUrl =
    "https://maps.google.com/maps?q=" +
    msg.location.latitude +
    "%2C" +
    msg.location.longitude +
    "&z=17&hl=pt-BR";

  msg.body = "data:image/png;base64," + msg.body + "|" + gmapsUrl;

  // temporaryly disable ts checks because of type definition bug for Location object
  // @ts-ignore
  msg.body +=
    "|" +
    // @ts-ignore
    (msg.location.description
      ? // @ts-ignore
        msg.location.description
      : msg.location.latitude + ", " + msg.location.longitude);

  return msg;
};

/**
 * Validate if passed message is a option for a queue related to the conection, and assign the ticket to this queue
 * otherwise send the conection welcome message + options
 * - IF the conection has only one queue, assign the ticket to this queue and return
 */
const verifyQueue = async (
  wbot: Session,
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  // Get the queues and the welcome message from the conection
  const { queues, greetingMessage } = await ShowWhatsAppService(wbot.id!);

  // IF the conection has only one queue, assign the ticket to this queue and return
  if (queues.length === 1) {
    // console.log("solo se encontro un departamento para este wpp");

    await UpdateTicketService({
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id
    });

    // let body: string;

    // if (queues[0].greetingMessage || queues[0].chatbotOptions?.length > 0) {
    //   if (queues[0].chatbotOptions?.length > 0) {
    //     let options = "";

    //     queues[0].chatbotOptions.forEach((chatbotOption, index) => {
    //       options += `*${chatbotOption.id}* - ${chatbotOption.name}\n`;
    //     });

    //     body = formatBody(
    //       `\u200e${queues[0].greetingMessage}\n${options}`,
    //       contact
    //     );
    //   } else {
    //     body = formatBody(`\u200e${queues[0].greetingMessage}`, contact);
    //   }

    //   const debouncedSentMessage = debounce(
    //     async () => {
    //       const sentMessage = await wbot.sendMessage(
    //         `${contact.number}@c.us`,
    //         body
    //       );

    //       await verifyMessage({ msg: sentMessage, ticket, contact });
    //     },
    //     3000,
    //     ticket.id
    //   );

    //   debouncedSentMessage();
    // }

    if (queues[0].automaticAssignment && queues[0].users.length > 0) {
      // console.log("se asigna automaticamente");

      let choosenQueueUsers = queues[0].users;

      if (!queues[0].automaticAssignmentForOfflineUsers) {
        // console.log("no se asigna a usuarios offline");
        // console.log(getConnectedUsers());

        const connectedUsers = getConnectedUsers();

        choosenQueueUsers = choosenQueueUsers.filter(user =>
          connectedUsers.includes(user.id)
        );
      }

      if (choosenQueueUsers.length > 0) {
        const choosenQueueUsersWithOpenTickets = await User.findAll({
          where: {
            id: {
              [Op.in]: choosenQueueUsers.map(user => user.id)
            }
          },
          include: [
            {
              model: Ticket,
              as: "tickets",
              required: false,
              where: {
                status: "open"
              }
            }
          ]
        });

        if (
          choosenQueueUsersWithOpenTickets &&
          choosenQueueUsersWithOpenTickets.length > 0
        ) {
          let choosenQueueUserWithLessTickets =
            choosenQueueUsersWithOpenTickets.sort((a, b) => {
              return a.tickets.length - b.tickets.length;
            })[0];

          await UpdateTicketService({
            ticketData: {
              userId: choosenQueueUserWithLessTickets.id,
              status: "open"
            },
            ticketId: ticket.id
          });

          verifyPrivateMessage(
            `Se ha *asignó automáticamente* a ${choosenQueueUserWithLessTickets.name}`,
            ticket,
            ticket.contact
          );
        }
      }
    }

    return;
  }

  // Consider the body msg as the selected option for a queue
  const selectedOption = msg.body;

  // Identify the choosen queue
  const choosenQueue = queues[+selectedOption - 1];

  // IF the choosen queue exists
  // - assign the ticket to this queue, send the queue welcome message with his categories options
  // - and save the send message in the database with verifyMessage()
  // ELSE
  // - send the conection welcome message with his queues options
  // - and save the send message in the database with verifyMessage()
  if (choosenQueue) {
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id
    });

    let body: string;

    if (choosenQueue.chatbotOptions?.length > 0) {
      let options = "";

      choosenQueue.chatbotOptions.forEach((chatbotOption, index) => {
        options += `*${chatbotOption.id}* - ${chatbotOption.name}\n`;
      });

      body = formatBody(
        `\u200e${choosenQueue.greetingMessage}\n${options}`,
        contact
      );
    } else {
      body = formatBody(`\u200e${choosenQueue.greetingMessage}`, contact);
    }

    const debouncedSentMessage = debounce(
      async () => {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@c.us`,
          body
        );

        await verifyMessage({ msg: sentMessage, ticket, contact });
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();

    if (choosenQueue.automaticAssignment && choosenQueue.users.length > 0) {
      // console.log("se asigna automaticamente");

      let choosenQueueUsers = choosenQueue.users;

      if (!choosenQueue.automaticAssignmentForOfflineUsers) {
        // console.log("no se asigna a usuarios offline");
        // console.log(getConnectedUsers());

        const connectedUsers = getConnectedUsers();

        choosenQueueUsers = choosenQueueUsers.filter(user =>
          connectedUsers.includes(user.id)
        );
      }

      if (choosenQueueUsers.length > 0) {
        const choosenQueueUsersWithOpenTickets = await User.findAll({
          where: {
            id: {
              [Op.in]: choosenQueueUsers.map(user => user.id)
            }
          },
          include: [
            {
              model: Ticket,
              as: "tickets",
              required: false,
              where: {
                status: "open"
              }
            }
          ]
        });

        if (
          choosenQueueUsersWithOpenTickets &&
          choosenQueueUsersWithOpenTickets.length > 0
        ) {
          let choosenQueueUserWithLessTickets =
            choosenQueueUsersWithOpenTickets.sort((a, b) => {
              return a.tickets.length - b.tickets.length;
            })[0];

          await UpdateTicketService({
            ticketData: {
              userId: choosenQueueUserWithLessTickets.id,
              status: "open"
            },
            ticketId: ticket.id
          });

          verifyPrivateMessage(
            `Se ha *asignó automáticamente* a ${choosenQueueUserWithLessTickets.name}`,
            ticket,
            ticket.contact
          );
        }
      }
    }
  } else {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    const body = formatBody(`\u200e${greetingMessage}\n${options}`, contact);

    const debouncedSentMessage = debounce(
      async () => {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@c.us`,
          body
        );
        verifyMessage({ msg: sentMessage, ticket, contact });
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

const isValidMsg = (msg: WbotMessage): boolean => {
  if (msg.from === "status@broadcast") return false;
  if (msg.body.length > 5000) return false;
  if (
    msg.type === "chat" ||
    msg.type === "audio" ||
    msg.type === "ptt" ||
    msg.type === "video" ||
    msg.type === "image" ||
    msg.type === "document" ||
    msg.type === "vcard" ||
    //msg.type === "multi_vcard" ||
    msg.type === "sticker" ||
    msg.type === "location"
  )
    return true;
  return false;
};

const handleMessage = async ({
  msg,
  wbot,
}: {
  msg: WbotMessage;
  wbot: Session;
}): Promise<void> => {

  if (!isValidMsg(msg)) {
    return;
  }

  try {
    let msgContact: WbotContact;
    let groupContact: Contact | undefined;

    // if i sent the message, msgContact is the contact that received the message
    // if i received the message, msgContact is the contact that sent the message
    if (msg.fromMe) {
      // messages sent automatically by wbot have a special character in front of it
      // if so, this message was already been stored in database;
      if (/\u200e/.test(msg.body[0]) || /\u200B/.test(msg.body[0])) {
        console.log("---- handleMessage - ignore bot message");
        return;
      }

      // media messages sent from me from cell phone, first comes with "hasMedia = false" and type = "image/ptt/etc"
      // in this case, return and let this message be handled by "media_uploaded" event, when it will have "hasMedia = true"
      if (
        !msg.hasMedia &&
        msg.type !== "location" &&
        msg.type !== "chat" &&
        msg.type !== "vcard"
        //&& msg.type !== "multi_vcard"
      )
        return;

      msgContact = await wbot.getContactById(msg.to);
    } else {
      msgContact = await msg.getContact();
    }

    const chat = await msg.getChat();

    // if the message is from a group,
    // and i sent the message, groupContact is the contact that received the message
    // and if i received the message, groupContact is the contact that sent the message
    // in any case, save the group contact in the database
    if (chat.isGroup) {
      let msgGroupContact;

      if (msg.fromMe) {
        msgGroupContact = await wbot.getContactById(msg.to);
      } else {
        msgGroupContact = await wbot.getContactById(msg.from);
      }

      groupContact = await verifyContact(msgGroupContact);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!);

    // if i sent the message, unreadMessages = 0 otherwise unreadMessages = chat.unreadCount
    const unreadMessages = msg.fromMe ? 0 : chat.unreadCount;

    const contact = await verifyContact(msgContact);

    // if the message is the conection farewell message, dont do anything
    if (
      unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === msg.body
    ) {
      let ticket = await Ticket.findOne({
        where: {
          status: "closed",
          contactId: groupContact ? groupContact.id : contact.id,
          whatsappId: whatsapp.id
        }
      });

      if (ticket) {
        await verifyMessage({ msg, ticket, contact });
      }

      return;
    }

    let ticket: Ticket | null;

    // Validamos primero si el mensaje puede pertenecer a un ticket ya existente
    // para no reabirlo ni nada de eso
    ticket = await SearchTicketForAMessageService({
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsapp.id,
      message: msg
    });

    // si no tenemos ticket, buscamos ahora lo manejamos tradicionalmente
    // buscando el ultimo ticket abierto del contacto o grupoContacto
    if (!ticket) {
      ticket = await FindOrCreateTicketService({
        contact,
        whatsappId: whatsapp.id,
        unreadMessages,
        groupContact,
        lastMessageTimestamp: msg.timestamp,
        msgFromMe: msg.fromMe
      });
    }

    let incomingMessage: null | Message = null;

    if (msg.hasMedia) {
      incomingMessage = await verifyMediaMessage(msg, ticket, contact);
    } else {
      incomingMessage = await verifyMessage({ msg, ticket, contact });
    }

    // If the message is not from a group or from me,
    // the message ticket has no queue or category,
    // has no user, and the conection has min 1 queues,
    // we considered it as a intro message from a contact, and whe send it a messages to choose a queue and a category
    if (
      !ticket.userHadContact &&
      !chat.isGroup &&
      !msg.fromMe &&
      whatsapp.queues.length >= 1
    ) {
      if (!ticket.queue) {
        await verifyQueue(wbot, msg, ticket, contact);
      } else {
        const msgBody = msg.body;

        const chatbotOption = await ShowChatbotOptionService(msgBody);

        if (chatbotOption) {
          if (chatbotOption.chatbotOptions.length > 0) {
            let options = "";

            chatbotOption.chatbotOptions.forEach((chatbotOption, index) => {
              options += `*${chatbotOption.id}* - ${chatbotOption.name}\n`;
            });

            const body = formatBody(
              `\u200e${chatbotOption.message}\n${options}`,
              contact
            );

            const debouncedSentMessage = debounce(
              async () => {
                const sentMessage = await wbot.sendMessage(
                  `${contact.number}@c.us`,
                  body
                );

                await verifyMessage({ msg: sentMessage, ticket, contact });
              },
              3000,
              ticket.id
            );

            debouncedSentMessage();
          } else {
            const body = formatBody(
              `\u200e${chatbotOption.message}\n`,
              contact
            );

            const debouncedSentMessage = debounce(
              async () => {
                const sentMessage = await wbot.sendMessage(
                  `${contact.number}@c.us`,
                  body
                );

                await verifyMessage({ msg: sentMessage, ticket, contact });
              },
              3000,
              ticket.id
            );

            debouncedSentMessage();
          }
        }
      }
    } else if (!ticket.queue && whatsapp.queues.length >= 1) {
      // El codigo de arriba es para un flujo que tiene funciones de chatbot
      // si el ticket no entraba en las condicionales de arriba se iba a quedar sin queue
      // por lo que si no entra arriba (ticket en el que no deberian de activarse las funciones del chatbot)
      // setea la primera queue que encuentre si hay
      try {
        await UpdateTicketService({
          ticketData: { queueId: whatsapp.queues[0].id },
          ticketId: ticket.id
        });
      } catch (error) {
        console.log(error);
        Sentry.captureException(
          "--  error trying to establish queue on ticket that was not going to have " +
            error
        );
      }
    }

    if (msg.type === "vcard") {
      try {
        const array = msg.body.split("\n");
        const obj = [];
        let contact = "";
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          const values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              obj.push({ number: values[ind] });
            }
            if (values[ind].indexOf("FN") !== -1) {
              contact = values[ind + 1];
            }
          }
        }
        for await (const ob of obj) {
          const cont = await CreateContactService({
            name: contact,
            number: ob.number.replace(/\D/g, "")
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    if (!msg.fromMe && ticket.chatbotMessageIdentifier) {
      const chatbotMessageReplied = await ChatbotMessage.findOne({
        where: {
          identifier:
            ticket.chatbotMessageLastStep || ticket.chatbotMessageIdentifier
        },
        include: [
          {
            model: ChatbotMessage,
            as: "chatbotOptions",
            order: [["order", "ASC"]],
            separate: true,
            where: { wasDeleted: false }
          }
        ]
      });

      if (
        chatbotMessageReplied &&
        chatbotMessageReplied.chatbotOptions.length > 0
      ) {
        const chooseOption = chatbotMessageReplied.chatbotOptions.find(co =>
          msg.body.toLocaleLowerCase().includes(co.label.toLocaleLowerCase())
        );

        if (chooseOption) {
          console.log("---- handleMessage - chooseOption: ", chooseOption);

          const nextChatbotMessage = await ChatbotMessage.findOne({
            where: {
              id: chooseOption.id
            },
            include: [
              {
                model: ChatbotMessage,
                as: "chatbotOptions",
                order: [["order", "ASC"]],
                separate: true,
                where: { wasDeleted: false }
              }
            ]
          });

          if (nextChatbotMessage) {
            let options = "";

            if (nextChatbotMessage.hasSubOptions) {
              options += "\n\n";
              nextChatbotMessage.chatbotOptions.forEach(
                (chatbotOption, index) => {
                  options += `*${
                    chatbotOption.label
                  }* - *${chatbotOption.title.trim()}* ${
                    index < nextChatbotMessage.chatbotOptions.length - 1
                      ? "\n\n"
                      : ""
                  }`;
                }
              );
            }

            const body = formatBody(
              `\u200e${nextChatbotMessage.value}${options}`,
              contact
            );

            console.log("---- handleMessage - nextChatbotMessage: ", body);

            if (nextChatbotMessage.mediaType === "image") {
              const imageMedia = await MessageMedia.fromUrl(
                nextChatbotMessage.mediaUrl
              );

              const debouncedSentMessage = debounce(
                async () => {
                  const sentMessage = await wbot.sendMessage(
                    `${contact.number}@c.us`,
                    imageMedia,
                    {
                      caption: body
                    }
                  );

                  await verifyMediaMessage(
                    sentMessage,
                    ticket,
                    contact,
                    true,
                    nextChatbotMessage.identifier
                  );
                },
                1500,
                ticket.id
              );

              debouncedSentMessage();
            } else {
              const debouncedSentMessage = debounce(
                async () => {
                  const sentMessage = await wbot.sendMessage(
                    `${contact.number}@c.us`,
                    body
                  );

                  await verifyMessage({
                    msg: sentMessage,
                    ticket,
                    contact,
                    identifier: nextChatbotMessage.identifier
                  });
                },
                1500,
                ticket.id
              );

              debouncedSentMessage();
            }

            ticket.update({
              chatbotMessageLastStep: nextChatbotMessage.identifier
            });
          }
        }
      }
    }

    await ticket.reload();

    if (
      !msg.fromMe &&
      !ticket.isGroup &&
      !ticket.userHadContact &&
      !ticket.marketingCampaignId &&
      ticket.queue?.marketingCampaigns?.length > 0
    ) {
      // console.log("---- handleMessage - handleMessage: ", ticket.queue);

      const marketingCampaigns = ticket.queue.marketingCampaigns;
      const defaultCampaign = marketingCampaigns.find(m => m.isDefault);

      let ticketMarketingCampaign = null;

      for (const marketingCampaign of marketingCampaigns) {
        if (marketingCampaign.isActive) {
          const keywords = JSON.parse(marketingCampaign.keywords);
          if (
            keywords.length > 0 &&
            keywords.find(kw =>
              msg.body.toLocaleLowerCase().includes(kw.toLocaleLowerCase())
            )
          ) {
            ticketMarketingCampaign = marketingCampaign;
            break;
          }
        }
      }

      if (!ticketMarketingCampaign && defaultCampaign) {
        ticketMarketingCampaign = defaultCampaign
      }

      if (ticketMarketingCampaign) {
        const messagesToSend =
          await MarketingCampaignAutomaticMessage.findAll({
            where: {
              marketingCampaignId: ticketMarketingCampaign.id
            }
          });

        if (messagesToSend.length > 0) {
          let sleepTime = 2000;

          messagesToSend.forEach(async messageToSend => {
            if (messageToSend.mediaType === "text") {
              let body = formatBody(`\u200e${messageToSend.body}`, contact);

              const debouncedSentMessage = debounce(
                async () => {
                  const sentMessage = await wbot.sendMessage(
                    `${contact.number}@c.us`,
                    body
                  );

                  await verifyMessage({
                    msg: sentMessage,
                    ticket,
                    contact,
                    shouldUpdateUserHadContact: false
                  });
                },
                sleepTime,
                ticket.id + messageToSend.id
              );

              debouncedSentMessage();
            } else {
              const newMedia = MessageMedia.fromFilePath(
                `public/${messageToSend.mediaUrl.split("/").pop()}`
              );

              let mediaOptions: MessageSendOptions = {
                sendAudioAsVoice: true
              };

              if (
                newMedia.mimetype.startsWith("image/") &&
                !/^.*\.(jpe?g|png|gif)?$/i.exec(messageToSend.mediaUrl)
              ) {
                mediaOptions["sendMediaAsDocument"] = true;
              }

              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(
                    `${contact.number}@c.us`,
                    newMedia,
                    mediaOptions
                  );
                },
                sleepTime,
                ticket.id + messageToSend.id
              );

              debouncedSentMessage();
            }

            sleepTime += 1000;
          });
        }

        await UpdateTicketService({
          ticketData: { marketingCampaignId: ticketMarketingCampaign.id },
          ticketId: ticket.id
        });

        try {
          // console.log("---- handleMessage - dataToSendToTrazabilidad TICKET: ", JSON.stringify(ticket));

          const dataToSendToTrazabilidad = {
            correo: ticket.contact?.email,
            nombre_cliente: ticket.contact?.name,
            telefono: ticket.contact?.number,
            paisIsocode: ticket.contact?.country?.textCode,
            rubro: "Restaurant.pe",
            cliente_origenregistro: "whaticket",
            campana_whatrestaurantid: ticketMarketingCampaign.id,
            returnFreshClient: true,
          };

          // EVALUAMOS SI LA CONEXION DE DONDE PROVIENE EL TICKET ES DE JUAN FAUSTO
          // SI ES ASI, SE ENVIA A TRAZABILIDAD CON UN PAIS ISOCODE ESPECIFICO
          if (ticket.whatsappId === 45) {
            dataToSendToTrazabilidad.paisIsocode = "MU";
          }

          const newTrazaLeadRequest = await fetch(
            "https://web.restaurant.pe/trazabilidad/public/rest/cliente/webHookQuiPuposWebLead",
            // "http://localhost/trazabilidadrestaurant/public/rest/cliente/webHookQuiPuposWebLead",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(dataToSendToTrazabilidad)
            }
          );

          const newTrazaLead = await newTrazaLeadRequest.json();

          if (
            newTrazaLead?.data &&
            newTrazaLead?.data?.usuario &&
            newTrazaLead?.data?.usuario?.usuario_whatrestaurantid
          ) {

            const newTrazaLeadUserId = newTrazaLead?.data?.usuario?.usuario_whatrestaurantid;

            UpdateTicketService({
              ticketData: {
                userId: newTrazaLeadUserId,
                status: "open",
              },
              ticketId: ticket.id
            });

          }

        } catch (error) {
          console.log("Error sending data to Trazabilidad: ", error);
          Sentry.captureException(error);
        }

      }
    }

    try {

      // console.log("............................................");
      // console.log("---- handleMessage - msg: ", msg);
      // console.log("---- handleMessage - whatsapp: ", whatsapp);

      // @ts-ignore
      if (msg.mentionedIds.length > 0 && whatsapp.lid && msg.mentionedIds.find( id => id === whatsapp.lid)) {

        // console.log("---- handleMessage - ENTRO A LA CONDICION UNO --- TICKET: ", ticket);

        if (ticket.participantUsers?.length > 0) {


          Promise.all(
            ticket.participantUsers.map(async user => {
              // console.log("---- handleMessage - ENTRO A LA CONDICION DE PARTICIPANTS: ", {
              // });

              const newNotification = await Notification.create({
                type: NOTIFICATIONTYPES.GROUP_MENTION,
                toUserId: user.id,
                ticketId: ticket.id,
                messageId: incomingMessage.id,
                whatsappId: whatsapp.id,
                queueId: ticket.queueId,
                contactId: ticket.contactId
              })

              const notification = await ShowNotificationService(
                newNotification.id
              )

              emitEvent({
                event: {
                  name: "notification",
                  data: {
                    action: NOTIFICATIONTYPES.GROUP_MENTION_CREATE,
                    data: notification
                  }
                }
              })
          }))



        } else if (ticket.queue) {

          const queue = await Queue.findByPk(ticket.queue.id, {
            include: [
              {
                model: User,
                as: "users",
               required: false
              }
            ]
          });

          const usersToNotify = queue.users;

          // console.log("---- handleMessage - ANTES DE REVISAR USERS TO NOTFIY");

          if (usersToNotify.length === 0) {
            return;
          }

          // console.log("---- handleMessage - USERS TO NOTFIY: ", usersToNotify.map(u => u.id));

          Promise.all(
            usersToNotify.map(async user => {

              // console.log("---- handleMessage - ANTES DE CREAR NOTIFICACIONES PARA TODOS LOS USUARIOS DEL GRUPO", {
              // });

              const newNotification = await Notification.create({
                type: NOTIFICATIONTYPES.GROUP_MENTION,
                toUserId: user.id,
                ticketId: ticket.id,
                messageId: incomingMessage.id,
                whatsappId: whatsapp.id,
                queueId: ticket.queueId,
                contactId: ticket.contactId
              })

              emitEvent({
                event: {
                  name: "notification",
                  data: {
                    action: NOTIFICATIONTYPES.GROUP_MENTION,
                    data: newNotification
                  }
                }
              })
            })
          )

        }

      }
    } catch (error) {
      console.log("Error creating group mention notification: ", error);
      Sentry.captureException(error);
    }

    /* if (msg.type === "multi_vcard") {
      try {
        const array = msg.vCards.toString().split("\n");
        let name = "";
        let number = "";
        const obj = [];
        const conts = [];
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          const values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              number = values[ind];
            }
            if (values[ind].indexOf("FN") !== -1) {
              name = values[ind + 1];
            }
            if (name !== "" && number !== "") {
              obj.push({
                name,
                number
              });
              name = "";
              number = "";
            }
          }
        }

        // eslint-disable-next-line no-restricted-syntax
        for await (const ob of obj) {
          try {
            const cont = await CreateContactService({
              name: ob.name,
              number: ob.number.replace(/\D/g, "")
            });
            conts.push({
              id: cont.id,
              name: cont.name,
              number: cont.number
            });
          } catch (error) {
            if (error.message === "ERR_DUPLICATED_CONTACT") {
              const cont = await GetContactService({
                name: ob.name,
                number: ob.number.replace(/\D/g, ""),
                email: ""
              });
              conts.push({
                id: cont.id,
                name: cont.name,
                number: cont.number
              });
            }
          }
        }
        msg.body = JSON.stringify(conts);
      } catch (error) {
        console.log(error);
      }
    } */
  } catch (err) {
    logger.error(`Error handling whatsapp message: Err: ${err}`);
    console.log(err);
    Sentry.captureException(err);
  }
};

const handleMsgAck = async (msg: WbotMessage, ack: MessageAck) => {
  await new Promise(r => setTimeout(r, 600));

  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(msg.id.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });
    if (!messageToUpdate) {
      return;
    }

    // console.log(
    //   "-- handleMsgAck -messageToUpdate:",
    //   messageToUpdate,
    //   " -ack: ",
    //   ack
    // );

    await messageToUpdate.update({ ack });

    emitEvent({
      to: [messageToUpdate.ticketId.toString()],
      event: {
        name: "appMessage",
        data: {
          action: "update",
          message: messageToUpdate
        }
      }
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const wbotMessageListener = (wbot: Session, whatsapp: Whatsapp): void => {
  wbot.on("message_create", async msg => {
    // logger.info(
    //   `BOT wbotMessageListener message_create - wpp id: ${whatsapp.id} - from: ${msg.from} - type ${msg.type}`
    // );

    handleMessage({ msg, wbot });

    try {
      // ignorar mensajes de grupos y de estados
      if (msg.id.remote.includes("@g") || msg.from === "status@broadcast") {
        return false;
      }
      // solo aceptar mensajes de texto
      if (msg.type === "chat") {
        const freshWpp = await Whatsapp.findByPk(whatsapp.id);

        if (!freshWpp) {
          throw new AppError("ERR_NO_WAPP_FOUND", 404);
        }

        if (freshWpp.webhook) {

          if (msg.from) {
            // @ts-ignore
            msg.fromNumber = msg.from.replace(/\D/g, "");
          }

          if (msg.to) {
            // @ts-ignore
            msg.toNumber = msg.to.replace(/\D/g, "");
          }

          fetch(freshWpp.webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(msg)
          }).catch(error => {
            console.log(
              `--- WEBHOOK ERROR WhatsappId: ${freshWpp.id}: `,
              error
            );
            Sentry.captureException(error);
          });
        }
      }
    } catch (error) {
      console.log("Error on sent message_create event to wpp webhook: ", error);
      Sentry.captureException(error);
    }
  });
  wbot.on("media_uploaded", async msg => {
    handleMessage({ msg, wbot });
  });
  wbot.on("group_update", async contact => {
    if (contact?.type !== "subject") {
      return;
    }

    console.log(
      "--- BOT wbotMessageListener group_update - wbot.id: ",
      wbot.id,
      contact
    );

    try {
      const groupContact = await Contact.findOne({
        where: { number: contact.chatId.split("@")[0] }
      });

      if (!groupContact) {
        throw new AppError(
          "No group contact found with this ID. " + contact.chatId
        );
      }

      // console.log("groupContact: ", groupContact);

      groupContact.update({
        name: contact.body
      });

      emitEvent({
        event: {
          name: "contact",
          data: {
            action: "update",
            contact: groupContact
          }
        }
      });
    } catch (err) {
      console.log("Error on group_update event: ", contact, err);
      Sentry.captureException(err);
    }
  });
  wbot.on("group_join", async notification => {
    // console.log(
    //   "--- BOT wbotMessageListener group_join - wbot.id: ",
    //   wbot.id,
    //   notification
    // );

    try {
      const wbotGroupContact = await wbot.getContactById(notification.chatId)
      const groupContact = await verifyContact(wbotGroupContact);

      const newTicket = await CreateTicketService({
        contactId: groupContact.id,
        whatsappId: wbot.id,
        status: "open",
        lastMessageTimestamp: Date.now() / 1000
      })

      emitEvent({
        to: [newTicket.status],
        event: {
          name: "ticket",
          data: {
            action: "update",
            ticket: newTicket
          }
        }
      });
    } catch (error) {
      console.log("Error on group_join event: ", notification, error);
      Sentry.captureException(error);
    }
  })
  wbot.on("message_edit", async (msg, newBody, prevBody) => {
    // console.log(
    //   "--- BOT wbotMessageListener message_edit - wbot.id: ",
    //   wbot.id,
    //   msg?.id.id,
    //   prevBody,
    //   newBody,
    //   (Date.now() / 1000) | 0
    // );

    try {
      let msgContact: WbotContact;

      if (msg.fromMe) {
        msgContact = await wbot.getContactById(msg.to);
      } else {
        msgContact = await msg.getContact();
      }

      const contact = await verifyContact(msgContact);

      const messages = await Message.findAll({
        attributes: ["id"],
        where: {
          [Op.or]: [
            {
              id: msg.id.id
            },
            {
              [Op.and]: [
                {
                  contactId: contact.id
                },
                {
                  body: prevBody as string
                },
                {
                  timestamp: {
                    [Op.gt]: (Date.now() / 1000) | -(60 * 5) // Menos de 5 minutos
                  }
                }
              ]
            }
          ]
        },
        include: [
          {
            model: Ticket,
            as: "ticket",
            attributes: ["id", "lastMessage"]
          }
        ]
      });

      // console.log("messages: ", JSON.stringify(messages));

      if (!messages.length) {
        // console.log("No message found with this ID. " + msg.id.id);
        return;
      }

      await Message.update(
        { body: msg.body, isEdited: true },
        {
          where: {
            id: {
              [Op.in]: messages.map(m => m.id)
            }
          }
        }
      );

      for (const message of messages) {
        const messageWithExtraData = await Message.findByPk(message.id, {
          include: [
            "contact",
            {
              model: Ticket,
              as: "ticket",
              attributes: ["id", "chatbotMessageIdentifier"],
              include: [
                {
                  attributes: ["name"],
                  model: MarketingCampaign,
                  as: "marketingCampaign",
                  required: false
                },
                {
                  attributes: ["name"],
                  model: MarketingMessagingCampaign,
                  as: "marketingMessagingCampaign",
                  required: false,
                  include: [
                    {
                      attributes: ["name"],
                      model: MarketingCampaign,
                      as: "marketingCampaign",
                      required: false
                    }
                  ]
                },
                {
                  model: MessagingCampaign,
                  as: "messagingCampaign",
                  attributes: ["id", "name"],
                  required: false
                }
              ]
            },
            {
              model: Message,
              as: "quotedMsg",
              include: ["contact"]
            }
          ]
        });

        emitEvent({
          to: [message.ticket.id.toString()],
          event: {
            name: "appMessage",
            data: {
              action: "update",
              message: messageWithExtraData || message
            }
          }
        });
      }

      const messagesAsLastMessageOfHisTicket = messages.filter(
        m => m.ticket.lastMessage === prevBody
      );

      if (!messagesAsLastMessageOfHisTicket.length) {
        return;
      }

      messagesAsLastMessageOfHisTicket.forEach(async message => {
        await UpdateTicketService({
          ticketData: {
            lastMessage: msg.body
          },
          ticketId: message.ticket.id
        });
      });
    } catch (err) {
      console.log("Error on message_edit event: ", msg, err);
      Sentry.captureException(err);
    }
  });
  wbot.on("message_ack", async (msg, ack) => {
    // la libreria a veces envia null como ack y causaba error
    if (ack === null) {
      console.log("____ message_ack EVENT SEND ME NULL, DONT UPDATE MESSAGE");
      return;
    }

    handleMsgAck(msg, ack);
  });
};

export { handleMessage, isValidMsg, wbotMessageListener };
