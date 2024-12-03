import { Request, Response } from "express";
import WAWebJS, { MessageMedia, MessageSendOptions } from "whatsapp-web.js";
import AppError from "../errors/AppError";
import formatBody from "../helpers/Mustache";
import { emitEvent } from "../libs/emitEvent";
import { getWbot } from "../libs/wbot";
import MessagingCampaign from "../models/MessagingCampaign";
import MessagingCampaignMessage from "../models/MessagingCampaignMessage";
import MessagingCampaignShipment from "../models/MessagingCampaignShipment";
import MessagingCampaignShipmentNumber from "../models/MessagingCampaignShipmentNumber";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import {
  verifyContact,
  verifyMessage
} from "../services/WbotServices/wbotMessageListener";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const messagingCampaigns = await MessagingCampaign.findAll({
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

  return res.status(200).json(messagingCampaigns);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { messagingCampaignId } = req.params;

  const messagingCampaign = await MessagingCampaign.findByPk(
    messagingCampaignId,
    {
      include: [
        {
          model: MessagingCampaignMessage,
          as: "messagingCampaignMessages",
          order: [["order", "ASC"]],
          required: false,
          separate: true
        },
        {
          model: MessagingCampaignShipment,
          as: "messagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true,
          include: [
            {
              model: MessagingCampaignShipmentNumber,
              as: "messagingCampaignShipmentNumbers",
              required: false
            },
            {
              model: Whatsapp,
              as: "whatsapp",
              required: false
            },
            {
              model: User,
              as: "user",
              required: false
            }
          ]
        }
      ]
    }
  );

  const messagingCampaignCopy = JSON.parse(JSON.stringify(messagingCampaign));

  messagingCampaignCopy.messagingCampaignShipments = await Promise.all(
    messagingCampaignCopy.messagingCampaignShipments.map(async shipment => {
      const shipmentTickets = await Ticket.findAll({
        where: {
          messagingCampaignShipmentId: shipment.id
        }
      });

      const filterCondition = (ticket: Ticket) =>
        ticket.status !== "closed" || (ticket.userHadContact && ticket.userId);

      const withResponse = shipmentTickets.filter(filterCondition);
      const noResponse = shipmentTickets.filter(
        ticket => !filterCondition(ticket)
      );

      return { ...shipment, withResponse, noResponse };
    })
  );

  return res.status(200).json(messagingCampaignCopy);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.body;

  const messagingCampaign = await MessagingCampaign.create({
    name
  });

  emitEvent({
    event: {
      name: "messagingCampaign",
      data: {
        action: "update",
        messagingCampaign
      }
    }
  });

  return res.status(200).json(messagingCampaign);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messagingCampaignId } = req.params;
  const { name } = req.body;

  let messagingCampaign = await MessagingCampaign.findByPk(
    messagingCampaignId,
    {
      include: [
        {
          model: MessagingCampaignShipment,
          as: "messagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true
        }
      ]
    }
  );

  messagingCampaign.update({
    name
  });

  emitEvent({
    event: {
      name: "messagingCampaign",
      data: {
        action: "update",
        messagingCampaign
      }
    }
  });

  return res.status(201).json(messagingCampaign);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messagingCampaignId } = req.params;

  let messagingCampaign = await MessagingCampaign.findByPk(messagingCampaignId);

  messagingCampaign.destroy();

  emitEvent({
    event: {
      name: "messagingCampaign",
      data: {
        action: "delete",
        messagingCampaignId: +messagingCampaignId
      }
    }
  });

  return res.status(200).send();
};

export const send = async (req: Request, res: Response): Promise<void> => {
  const {
    messagingCampaignId: messagingCampaignIdAsString,
    whatsappId: whatsappIdAsString,
    numbersToSend: numbersToSendAsString
  } = req.body;

  const messagingCampaignId = +messagingCampaignIdAsString;
  const whatsappId = +whatsappIdAsString;
  const numbersToSend = JSON.parse(numbersToSendAsString);

  console.log("--- send: ", req.body);

  const medias = req.files as Express.Multer.File[];

  if (!medias[0]) {
    throw new AppError("Falta el excel", 404);
  }

  const result = { ok: true, logs: [], errors: [], numbersWithErrors: [] };

  const messagingCampaign = await MessagingCampaign.findByPk(
    messagingCampaignId,
    {
      include: [
        {
          model: MessagingCampaignMessage,
          as: "messagingCampaignMessages",
          order: [["order", "ASC"]],
          required: false,
          separate: true
        },
        {
          model: MessagingCampaignShipment,
          as: "messagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true
        }
      ]
    }
  );

  if (!messagingCampaign) {
    throw new AppError("Campaña de mensajes no encontrada", 404);
  }

  if (messagingCampaign.messagingCampaignMessages.length === 0) {
    throw new AppError("Campaña de mensajes no tiene mensajes", 404);
  }

  if (messagingCampaign.messagingCampaignMessages[0]?.mediaType !== "text") {
    throw new AppError(
      "El primer mensaje de la campaña debe ser de texto",
      404
    );
  }

  if (messagingCampaign.messagingCampaignShipments[0]?.status === "sending") {
    throw new AppError("Hay un envío de campaña de mensajes en curso", 404);
  }

  await messagingCampaign.update({
    timesSent: messagingCampaign.timesSent + 1
  });

  const newMessagingCampaignShipment = await MessagingCampaignShipment.create({
    messagingCampaignId: messagingCampaign.id,
    startTimestamp: (Date.now() / 1000) | 0,
    whatsappId,
    userId: req.user.id,
    excelUrl: medias[0].filename
  });

  await messagingCampaign.reload();

  emitEvent({
    event: {
      name: "messagingCampaign",
      data: {
        action: "update",
        messagingCampaign
      }
    }
  });

  res.status(200).json({
    message: "Envio de campaña de mensajes iniciado",
    messagingCampaign,
    newMessagingCampaignShipment
  });

  let shipmentCanceled = false;

  (async () => {
    for (const numberObj of numbersToSend) {
      let numberFailed = false;

      // verify if the shipment was canceled
      const shipment = await MessagingCampaignShipment.findByPk(
        newMessagingCampaignShipment.id
      );

      if (shipment.status === "canceled") {
        shipmentCanceled = true;
        break;
      }

      try {
        await CheckIsValidContact(numberObj.number, whatsappId);

        const wbot = getWbot(whatsappId);

        const sentMessages: WAWebJS.Message[] = [];

        for (const messageToSend of messagingCampaign.messagingCampaignMessages) {
          let msg: WAWebJS.Message;

          if (messageToSend.mediaType === "text") {
            const messageToSendBodyWithVars = messageToSend.body.replace(
              /{{\s*(\w+)\s*}}/g,
              (match, key) => numberObj[key] || ""
            );

            let body = formatBody(`\u200e${messageToSendBodyWithVars}`);

            await new Promise(async (resolve, reject) => {
              try {
                const msg = await wbot.sendMessage(
                  `${numberObj.number}@c.us`,
                  body
                );

                sentMessages.push(msg);

                const msgContact = await wbot.getContactById(msg.to);
                const contact = await verifyContact(msgContact);

                const ticket = await FindOrCreateTicketService({
                  contact,
                  whatsappId: whatsappId,
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
              result.errors.push(error.message);
              result.numbersWithErrors.push({
                number: numberObj.number,
                error: error.message
              });
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
                msg = await wbot.sendMessage(
                  `${numberObj.number}@c.us`,
                  newMedia,
                  mediaOptions
                );

                sentMessages.push(msg);

                setTimeout(() => {
                  resolve(null);
                }, 1500);
              } catch (error) {
                reject(error);
              }
            }).catch(error => {
              result.errors.push(error.message);
              result.numbersWithErrors.push({
                number: numberObj.number,
                error: error.message
              });
            });
          }
        }
      } catch (error) {
        result.ok = false;
        console.log("--- Error en send", error);
        result.errors.push(error.message);
        result.numbersWithErrors.push({
          number: numberObj.number,
          error: error.message
        });

        numberFailed = true;
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

    await messagingCampaign.reload();

    emitEvent({
      event: {
        name: "messagingCampaign",
        data: {
          action: "update",
          messagingCampaign
        }
      }
    });
  })();
};

export const cancel = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messagingCampaignId } = req.body;

  const messagingCampaign = await MessagingCampaign.findByPk(
    messagingCampaignId,
    {
      include: [
        {
          model: MessagingCampaignShipment,
          as: "messagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true
        }
      ]
    }
  );

  if (messagingCampaign.messagingCampaignShipments?.[0].status === "sending") {
    await messagingCampaign.messagingCampaignShipments?.[0].update({
      status: "canceled"
    });
  }

  messagingCampaign.reload();

  emitEvent({
    event: {
      name: "messagingCampaign",
      data: {
        action: "update",
        messagingCampaign
      }
    }
  });

  return res.status(200).json(messagingCampaign);
};
