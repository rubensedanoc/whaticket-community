import ExcelJS from "exceljs";
import { Request, Response } from "express";
import WAWebJS, { MessageMedia, MessageSendOptions } from "whatsapp-web.js";
import AppError from "../errors/AppError";
import formatBody from "../helpers/Mustache";
import { getWbot } from "../libs/wbot";
import Category from "../models/Category";
import Log from "../models/Log";
import MarketingCampaign from "../models/MarketingCampaign";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import MessagingCampaign from "../models/MessagingCampaign";
import MessagingCampaignShipment from "../models/MessagingCampaignShipment";
import MessagingCampaignShipmentNumber from "../models/MessagingCampaignShipmentNumber";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import { getCountryIdOfNumber } from "../services/ContactServices/CreateOrUpdateContactService";
import SearchLogTypeService from "../services/LogServices/SearchLogTypeService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import SendApiChatbotMessage from "../services/WbotServices/SendApiChatbotMessage";
import SendExternalWhatsAppImageMessage from "../services/WbotServices/SendExternalWhatsAppImageMessage";
import SendExternalWhatsAppMessage from "../services/WbotServices/SendExternalWhatsAppMessage";
import {
  verifyContact,
  verifyMessage
} from "../services/WbotServices/wbotMessageListener";
import getUnixTimestamp from "../utils/getUnixTimestamp";
import sleepPromise from "../utils/sleepPromise";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import { emitEvent } from "../libs/emitEvent";
import ContactClientelicencia from "../models/ContactClientelicencias";
import { Op } from "sequelize";
import dayjs from "dayjs";
import Message from "../models/Message";

export const sendApiChatbotMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("--- CALL FOR sendApiChatbotMessage", req.body);

  const {
    botNumber,
    toNumbers,
    messageVariables,
    chatbotMessageIdentifier,
    localbi_id
  } = req.body;

  const result = await SendApiChatbotMessage({
    botNumber,
    toNumbers,
    messageVariables,
    chatbotMessageIdentifier,
    localbi_id
  });

  if (!result.ok) {
    return res.status(400).json(result);
  }

  return res.status(200).json(result);
};

export const sendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fromNumber, toNumber, message } = req.body;

  const sendExternalWhatsAppMessage = await SendExternalWhatsAppMessage({
    fromNumber,
    toNumber,
    message,
    createRegisterInDb: true
  });

  return res.status(200).json(sendExternalWhatsAppMessage);
};

export const sendMakeMessaginCampaign = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("--- CALL FOR sendMakeMessaginCampaign", req.body);

  const { desdeNumero, data } = req.body;

  if (!desdeNumero) {
    throw new AppError(
      "No mandaste el número de Whatsapp desde donde se van a enviar los mensajes",
      404
    );
  }

  const whatsapp = await Whatsapp.findOne({
    where: {
      number: desdeNumero
    }
  });

  if (!whatsapp) {
    throw new AppError("Whatsapp no encontrado", 404);
  }

  if (!data) {
    throw new AppError(
      "No mandaste data, recuerda de que debes de mandar un array de objectos",
      404
    );
  }

  const messagingCampaign = await MessagingCampaign.findOne({
    where: {
      name: "MAKE"
    },
    include: [
      {
        model: MessagingCampaignShipment,
        as: "messagingCampaignShipments",
        order: [["id", "DESC"]],
        required: false,
        separate: true
      }
    ]
  });

  if (!messagingCampaign) {
    throw new AppError("Campaña de mensajes MAKE no encontrada", 404);
  }

  if (messagingCampaign.messagingCampaignShipments[0]?.status === "sending") {
    throw new AppError("Hay un envío de campaña de mensajes en curso", 500);
  }

  await messagingCampaign.update({
    timesSent: messagingCampaign.timesSent + 1
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("data");

  // Agregar encabezados
  worksheet.columns = [
    { header: "Número", key: "number", width: 50 },
    { header: "Mensaje", key: "message", width: 100 }
  ];

  data.forEach(item => {
    worksheet.addRow({ number: item.number, message: item.message });
  });

  const excelName = `${messagingCampaign.name}-${Date.now()}.xlsx`;

  await workbook.xlsx.writeFile("public/" + excelName);

  console.log("Excel creado");
  console.log("messagingCampaign", messagingCampaign);
  console.log("messagingCampaign id", messagingCampaign.id);

  const newMessagingCampaignShipment = await MessagingCampaignShipment.create({
    messagingCampaignId: messagingCampaign.id,
    startTimestamp: (Date.now() / 1000) | 0,
    whatsappId: whatsapp.id,
    excelUrl: excelName
  });

  await messagingCampaign.reload();

  let shipmentCanceled = false;
  let numbersWithErrors = [];

  console.log("newMessagingCampaignShipment", newMessagingCampaignShipment);

  for (const numberObj of data) {
    const { number, message } = numberObj;

    let numberFailed = false;

    try {
      // verify if the shipment was canceled
      const shipment = await MessagingCampaignShipment.findByPk(
        newMessagingCampaignShipment.id
      );

      if (shipment.status === "canceled") {
        shipmentCanceled = true;
        break;
      }

      await CheckIsValidContact(number, whatsapp.id);

      const wbot = getWbot(whatsapp.id);

      const sentMessages: WAWebJS.Message[] = [];

      let msg: WAWebJS.Message;

      let body = formatBody(`\u200e${message}`);

      await new Promise(async (resolve, reject) => {
        try {
          const msg = await wbot.sendMessage(`${number}@c.us`, body);

          sentMessages.push(msg);

          const msgContact = await wbot.getContactById(msg.to);
          const contact = await verifyContact(msgContact);

          const ticket = await FindOrCreateTicketService({
            contact,
            whatsappId: whatsapp.id,
            unreadMessages: 0,
            groupContact: null,
            lastMessageTimestamp: msg.timestamp,
            messagingCampaignId: messagingCampaign.id,
            messagingCampaignShipmentId: newMessagingCampaignShipment.id,
            msgFromMe: msg.fromMe
          });

          await verifyMessage({
            msg,
            ticket,
            contact
          });

          setTimeout(() => {
            resolve(null);
          }, 1500);
        } catch (error) {
          reject(error);
        }
      }).catch(error => {
        numberFailed = true;
        numbersWithErrors.push({
          number,
          error: error.message
        });
      });
    } catch (error) {
      numberFailed = true;
      numbersWithErrors.push({
        number,
        error: error.message
      });
    }

    await MessagingCampaignShipmentNumber.create({
      number: numberObj.number,
      hadError: numberFailed,
      messagingCampaignShipmentId: newMessagingCampaignShipment.id
    });
  }

  await newMessagingCampaignShipment.update({
    endTimestamp: (Date.now() / 1000) | 0,
    status: shipmentCanceled ? undefined : "sent"
  });

  return res.status(200).json({
    message: "Campaña de mensajes MAKE enviada",
    numbersWithErrors
  });
};

export const sendMarketingCampaignIntro = async (
  req: Request,
  res: Response
): Promise<Response> => {
  req.myLog(
    "--- CALL FOR sendMarketingCampaignIntro" + JSON.stringify(req.body)
  );

  let {
    contacto_numero,
    contact_nombre,
    contact_correo,
    contact_nombre_negocio,
    user_id,
    campaign_id
  } = req.body;

  if (
    !contacto_numero ||
    !contact_nombre ||
    !contact_correo ||
    !contact_nombre_negocio ||
    !user_id ||
    !campaign_id
  ) {
    throw new AppError("Faltan datos");
  }

  contacto_numero = contacto_numero.replace(/\D/g, "");

  const countryId = await getCountryIdOfNumber(contacto_numero);

  let whatsapp = await Whatsapp.findOne({
    where: {
      countryId
    }
  });

  if (!whatsapp) {
    whatsapp = await Whatsapp.findOne({
      where: {
        isDefault: true
      }
    });
    if (!whatsapp) {
      throw new AppError(
        "No se encontró un Whatsapp para el pais de este lead ni uno por defecto",
        400
      );
    }
  }

  req.myLog("validando el contacto con el wpp id " + whatsapp.id);
  await CheckIsValidContact(contacto_numero, whatsapp.id);

  const wbot = getWbot(whatsapp.id);

  const marketingCampaign = await MarketingCampaign.findByPk(campaign_id, {
    include: [
      {
        model: MarketingCampaignAutomaticMessage,
        as: "marketingCampaignAutomaticMessages",
        required: false,
        order: [["order", "ASC"]],
        separate: true
      }
    ]
  });

  if (!marketingCampaign) {
    throw new AppError("Campaña de marketing no encontrada", 404);
  }

  if (!marketingCampaign.isActive) {
    throw new AppError("Campaña de marketing no activa", 400);
  }

  const messagesToSend = marketingCampaign.marketingCampaignAutomaticMessages;

  if (messagesToSend.length === 0) {
    throw new AppError("No hay mensajes para enviar", 400);
  }

  const logType = await SearchLogTypeService("send-marketingCampaign-intro");

  const log = await Log.create({
    logTypeId: logType.id,
    startTimestamp: getUnixTimestamp(),
    incomingEndpoint: req.originalUrl,
    incomingData: JSON.stringify(req.body)
  });

  let ticket = null;
  let contact = null;
  let wasOk = true;
  let errorArr = [];

  const defaultCategory = await Category.findOne({
    where: { isDefault: true }
  });

  req.myLog("enviando mensajes");
  for (const messageToSend of messagesToSend) {
    if (messageToSend.mediaType === "text") {
      try {
        req.myLog("mensaje de texto");
        let body = formatBody(`\u200e${messageToSend.body}`);

        const msg = await wbot.sendMessage(`${contacto_numero}@c.us`, body);

        const msgContact = await wbot.getContactById(msg.to);

        contact = await verifyContact(msgContact);

        const userExists = await User.findByPk(user_id);

        req.myLog("userExists: " + userExists);

        ticket = await FindOrCreateTicketService({
          contact,
          whatsappId: whatsapp.id,
          unreadMessages: 0,
          groupContact: null,
          lastMessageTimestamp: msg.timestamp,
          marketingCampaignId: marketingCampaign.id,
          msgFromMe: msg.fromMe,
          userId: userExists ? user_id : undefined,
          categoriesIds:
            userExists && defaultCategory ? [defaultCategory.id] : undefined
        });

        await verifyMessage({
          msg,
          ticket,
          contact
        });

        await sleepPromise(1500);
      } catch (error) {
        console.log({ error });
        wasOk = false;
        errorArr.push(error);
      }
    } else {
      try {
        req.myLog("mensaje multimedia");
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

        const msg = await wbot.sendMessage(
          `${contacto_numero}@c.us`,
          newMedia,
          mediaOptions
        );

        await sleepPromise(1500);
      } catch (error) {
        console.log({ error });
        wasOk = false;
        errorArr.push(error);
      }
    }
  }

  await log.update({
    endTimestamp: getUnixTimestamp(),
    contactId: contact?.id,
    ticketId: ticket?.id,
    whatsappId: whatsapp?.id,
    userId: user_id,
    marketingCampaignId: marketingCampaign.id,
    wasOk,
    error: JSON.stringify(errorArr)
  });

  return res.status(200).json({ data: log, reqLogs: req.myLog });
};

export const sendImageMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fromNumber, toNumber, imageUrl, caption } = req.body;

  const newMessage = await SendExternalWhatsAppImageMessage({
    fromNumber,
    toNumber,
    imageUrl,
    caption
  });

  return res.status(200).json(newMessage);
};

export const updateFromTrazaByClientelicenciaId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { clientelicenciaId, etapacl_id } = req.body;

  if (!clientelicenciaId || !etapacl_id) {
    throw new AppError("Faltan datos: clientelicenciaId o etapacl_id");
  }

  const contacts = await Contact.findAll({
    include: [
      {
        model: ContactClientelicencia,
        as: "contactClientelicencias",
        where: {
          traza_clientelicencia_id: clientelicenciaId
        },
        required: true
      }
    ],
  });

  if (!contacts || contacts.length === 0) {
    throw new AppError("No se encontró un contacto con el clientelicenciaId proporcionado", 404);
  }

  for (const contact of contacts) {
    await contact.update({
      traza_clientelicencia_currentetapaid: etapacl_id
    });

    const ticketsToUpdate = await Ticket.findAll({
      where: {
        contactId: contact.id,
      }
    });

    ticketsToUpdate.forEach(async (ticket) => {
      const ticketWithAllData = await ShowTicketService(ticket.id, true);

      emitEvent({
        to: [ticket.status],
        event: {
          name: "ticket",
          data: {
            action: "update",
            ticket: ticketWithAllData
          }
        }
      });
    });
  }

  return res.status(200).json({
    tipo: 1,
    mensajes: ["Whaticket - Contacto actualizado correctamente"],
    data: contacts
  });
};

export const getConversationMessages = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const mensajes = [];
  const data = {};

  const { fecha_inicio, fecha_fin, user_id } = req.params;

  if (!mensajes.length) {
    const ticketsInTimeRange = await Ticket.findAll({
      where: {
        createdAt: {
          [Op.gte]: dayjs(fecha_inicio).startOf("day").toDate(),
          [Op.lte]: dayjs(fecha_fin).endOf("day").toDate()
        },
        isGroup: false,
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name"],
          where: {
            isCompanyMember: {
              [Op.or]: [null, false]
            }
          },
          required: true
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "name"],
          required: true
        },
      ],
      // logging: (sql) => {
      //   mensajes.push(`SQL: ${sql}`);
      // }
    });

    mensajes.push(
      `Se encontraron ${ticketsInTimeRange.length} tickets entre las fechas ${fecha_inicio} y ${fecha_fin}`);

    const contactsIdsInTimeRange = ticketsInTimeRange.map(ticket => ticket.contactId);

    const ticketsToGetMessages = await Ticket.findAll({
      where: {
        contactId: {
          [Op.in]: contactsIdsInTimeRange
        },
      }
    });

    mensajes.push(
      `De los anteriores se van a recuperar mensajes de ${ticketsToGetMessages.length} tickets`);

    const messages = await Message.findAll({
      attributes: ["id", "fromMe", "body", "mediaType", "timestamp", "isPrivate", "ticketId"],
      where: {
        ticketId: {
          [Op.in]: ticketsToGetMessages.map(ticket => ticket.id)
        },
        isPrivate: {
          [Op.or]: [null, false]
        },
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name"],
        },
        {
          model: Ticket,
          as: "ticket",
          attributes: ["id"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name"],
            },
            {
              model: Contact,
              as: "contact",
              attributes: ["id", "name", "number"],
            },
            {
              model: Whatsapp,
              as: "whatsapp",
              attributes: ["id", "name", "number"],
              required: true
            },
          ],
          required: true
        }
      ],
      order: [["timestamp", "ASC"]]
    });

    mensajes.push(
      `Se encontraron ${messages.length} mensajes de los tickets recuperados`
    );

    messages.forEach(messageInstance => {
      const message: any = messageInstance.get({ plain: true }); // 👈 Conversión a objeto plano

      if (message.ticket?.id === 27204) {
        console.log("Mensaje de ticket 27204", message);
      }

      const ticketContact = message.ticket.contact;
      const ticketWhatsapp = message.ticket.whatsapp;

      if (!data[ticketContact?.id]) {
        data[ticketContact?.id] = {
          contact: {
            id: ticketContact?.id,
            name: ticketContact.name,
            number: ticketContact.number,
            createdAt: ticketContact.createdAt
          },
          whatsapp: {
            id: ticketWhatsapp?.id,
            name: ticketWhatsapp?.name,
            number: ticketWhatsapp?.number
          },
          messages: []
        };
      }

      message.ticket_user_name = message.ticket?.user?.name || "Sin asignar";

      delete message.contact;
      delete message.ticket;

      if (message.body.length > 1000) {
        message.body = message.body.substring(0, 1000) + "...";
      }

      data[ticketContact.id].messages.push(message);
    })

  }

  return res.status(200).json({
    mensajes,
    data
  });
};
