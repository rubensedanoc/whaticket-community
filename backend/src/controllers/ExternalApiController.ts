import ExcelJS from "exceljs";
import { Request, Response } from "express";
import WAWebJS, { MessageMedia, MessageSendOptions } from "whatsapp-web.js";
import AppError from "../errors/AppError";
import formatBody from "../helpers/Mustache";
import { getWbot } from "../libs/wbot";
import MessagingCampaign from "../models/MessagingCampaign";
import MessagingCampaignShipment from "../models/MessagingCampaignShipment";
import MessagingCampaignShipmentNumber from "../models/MessagingCampaignShipmentNumber";
import Whatsapp from "../models/Whatsapp";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import SendApiChatbotMessage from "../services/WbotServices/SendApiChatbotMessage";
import SendExternalWhatsAppImageMessage from "../services/WbotServices/SendExternalWhatsAppImageMessage";
import SendExternalWhatsAppMessage from "../services/WbotServices/SendExternalWhatsAppMessage";
import {
  verifyContact,
  verifyMessage
} from "../services/WbotServices/wbotMessageListener";
import { getCountryIdOfNumber } from "../services/ContactServices/CreateOrUpdateContactService";
import MarketingCampaign from "../models/MarketingCampaign";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import User from "../models/User";

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
            msgFromMe: msg.fromMe,
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
  console.log("--- CALL FOR sendMarketingCampaignIntro", req.body);

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
    !contact_nombre_negocio
  ) {
    throw new AppError("Faltan datos del contacto", 400);
  }

  if (!user_id || !campaign_id) {
    throw new AppError("Faltan datos del usuario o campaña", 400);
  }

  contacto_numero = contacto_numero.replace(/\D/g, "");

  const countryId = await getCountryIdOfNumber(contacto_numero);

  const whatsapp = await Whatsapp.findOne({
    where: {
      countryId
    }
  });

  if (!whatsapp) {
    throw new AppError("No encontramos un Whatsapp para este lead", 404);
  }

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

  console.log("antes de enviar los mensajes");

  for (const messageToSend of messagesToSend) {
    if (messageToSend.mediaType === "text") {
      let body = formatBody(`\u200e${messageToSend.body}`);

      await new Promise(async (resolve, reject) => {
        try {
          const msg = await wbot.sendMessage(`${contacto_numero}@c.us`, body);

          const msgContact = await wbot.getContactById(msg.to);

          const contact = await verifyContact(msgContact);

          const userExists = await User.findByPk(user_id);

          const ticket = await FindOrCreateTicketService({
            contact,
            whatsappId: whatsapp.id,
            unreadMessages: 0,
            groupContact: null,
            lastMessageTimestamp: msg.timestamp,
            marketingCampaignId: marketingCampaign.id,
            msgFromMe: msg.fromMe,
            userId: userExists && user_id
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
        console.log({ error });
      });
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

      await new Promise(async (resolve, reject) => {
        try {
          const msg = await wbot.sendMessage(
            `${contacto_numero}@c.us`,
            newMedia,
            mediaOptions
          );

          setTimeout(() => {
            resolve(null);
          }, 1500);
        } catch (error) {
          reject(error);
        }
      }).catch(error => {
        console.log({ error });
      });
    }
  }

  return res.sendStatus(200);
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
