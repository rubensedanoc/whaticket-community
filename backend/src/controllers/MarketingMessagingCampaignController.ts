import { Request, Response } from "express";
import WAWebJS, { MessageMedia, MessageSendOptions } from "whatsapp-web.js";
import AppError from "../errors/AppError";
import formatBody from "../helpers/Mustache";
import { emitEvent } from "../libs/emitEvent";
import { getWbot } from "../libs/wbot";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaign from "../models/MarketingMessagingCampaigns";
import MarketingMessagingCampaignShipment from "../models/MarketingMessagingCampaignShipment";
import MarketingMessagingCampaignShipmentNumber from "../models/MarketingMessagingCampaignShipmentNumber";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import {
  verifyContact,
  verifyMessage
} from "../services/WbotServices/wbotMessageListener";

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { marketingMessagingCampaignId } = req.params;

  const marketingMessagingCampaign = await MarketingMessagingCampaign.findByPk(
    marketingMessagingCampaignId,
    {
      include: [
        {
          model: MarketingCampaignAutomaticMessage,
          as: "marketingCampaignAutomaticMessages",
          order: [["order", "ASC"]],
          required: false,
          separate: true
        },
        {
          model: MarketingMessagingCampaignShipment,
          as: "marketingMessagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true,
          include: [
            {
              model: MarketingMessagingCampaignShipmentNumber,
              as: "marketingMessagingCampaignShipmentNumbers",
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

  const messagingCampaignCopy = JSON.parse(
    JSON.stringify(marketingMessagingCampaign)
  );

  messagingCampaignCopy.marketingMessagingCampaignShipments = await Promise.all(
    messagingCampaignCopy.marketingMessagingCampaignShipments.map(
      async shipment => {
        const shipmentTickets = await Ticket.findAll({
          where: {
            marketingMessagingCampaignShipmentId: shipment.id
          }
        });

        const filterCondition = (ticket: Ticket) =>
          ticket.status !== "closed" ||
          (ticket.userHadContact && ticket.userId);

        const withResponse = shipmentTickets.filter(filterCondition);
        const noResponse = shipmentTickets.filter(
          ticket => !filterCondition(ticket)
        );

        return { ...shipment, withResponse, noResponse };
      }
    )
  );

  return res.status(200).json(messagingCampaignCopy);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, marketingCampaignId } = req.body;

  const newMarketingMessagingCampaign = await MarketingMessagingCampaign.create(
    {
      name,
      marketingCampaignId
    }
  );

  emitEvent({
    event: {
      name: "marketingMessagingCampaign",
      data: {
        action: "update",
        marketingMessagingCampaign: newMarketingMessagingCampaign
      }
    }
  });

  return res.status(200).json(newMarketingMessagingCampaign);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { marketingMessagingCampaignId } = req.params;
  const { name } = req.body;

  let marketingMessagingCampaign = await MarketingMessagingCampaign.findByPk(
    marketingMessagingCampaignId
  );

  marketingMessagingCampaign.update({
    name
  });

  emitEvent({
    event: {
      name: "marketingMessagingCampaign",
      data: {
        action: "update",
        marketingMessagingCampaign
      }
    }
  });

  return res.status(201).json(marketingMessagingCampaign);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { marketingMessagingCampaignId } = req.params;

  let marketingMessagingCampaign = await MarketingMessagingCampaign.findByPk(
    marketingMessagingCampaignId
  );

  marketingMessagingCampaign.destroy();

  emitEvent({
    event: {
      name: "marketingMessagingCampaign",
      data: {
        action: "delete",
        marketingMessagingCampaignId: +marketingMessagingCampaignId
      }
    }
  });

  return res.status(200).send();
};

// -----

export const send = async (req: Request, res: Response): Promise<void> => {
  const {
    marketingMessagingCampaignId: marketingMessagingCampaignIdAsString,
    whatsappId: whatsappIdAsString,
    numbersToSend: numbersToSendAsString
  } = req.body;

  const marketingMessagingCampaignId = +marketingMessagingCampaignIdAsString;
  const whatsappId = +whatsappIdAsString;
  const numbersToSend = JSON.parse(numbersToSendAsString);

  console.log("--- send: ", req.body);

  const medias = req.files as Express.Multer.File[];

  if (!medias[0]) {
    throw new AppError("Falta el excel", 404);
  }

  const result = { ok: true, logs: [], errors: [], numbersWithErrors: [] };

  const marketingMessagingCampaign = await MarketingMessagingCampaign.findByPk(
    marketingMessagingCampaignId,
    {
      include: [
        {
          model: MarketingCampaignAutomaticMessage,
          as: "marketingCampaignAutomaticMessages",
          order: [["order", "ASC"]],
          required: false,
          separate: true
        },
        {
          model: MarketingMessagingCampaignShipment,
          as: "marketingMessagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true
        }
      ]
    }
  );

  if (!marketingMessagingCampaign) {
    throw new AppError("Campaña de mensajes no encontrada", 404);
  }

  if (
    marketingMessagingCampaign.marketingCampaignAutomaticMessages.length === 0
  ) {
    throw new AppError("Campaña de mensajes no tiene mensajes", 404);
  }

  if (
    marketingMessagingCampaign.marketingCampaignAutomaticMessages[0]
      ?.mediaType !== "text"
  ) {
    throw new AppError(
      "El primer mensaje de la campaña debe ser de texto",
      404
    );
  }

  if (
    marketingMessagingCampaign.marketingMessagingCampaignShipments[0]
      ?.status === "sending"
  ) {
    throw new AppError("Hay un envío de campaña de mensajes en curso", 404);
  }

  await marketingMessagingCampaign.update({
    timesSent: marketingMessagingCampaign.timesSent + 1
  });

  const newMarketingMessagingCampaignShipment =
    await MarketingMessagingCampaignShipment.create({
      marketingMessagingCampaignId: marketingMessagingCampaign.id,
      startTimestamp: (Date.now() / 1000) | 0,
      whatsappId,
      userId: req.user.id,
      excelUrl: medias[0].filename
    });

  await marketingMessagingCampaign.reload();

  emitEvent({
    event: {
      name: "marketingMessagingCampaign",
      data: {
        action: "update",
        marketingMessagingCampaign
      }
    }
  });

  res.status(200).json({
    message: "Envio de campaña de mensajes iniciado",
    marketingMessagingCampaign,
    newMarketingMessagingCampaignShipment
  });

  let shipmentCanceled = false;

  (async () => {
    for (const numberObj of numbersToSend) {
      let numberFailed = false;

      // verify if the shipment was canceled
      const shipment = await MarketingMessagingCampaignShipment.findByPk(
        newMarketingMessagingCampaignShipment.id
      );

      if (shipment.status === "canceled") {
        shipmentCanceled = true;
        break;
      }

      try {
        await CheckIsValidContact(numberObj.number, whatsappId);

        const wbot = getWbot(whatsappId);

        const sentMessages: WAWebJS.Message[] = [];

        for (const messageToSend of marketingMessagingCampaign.marketingCampaignAutomaticMessages) {
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
                  marketingMessagingCampaignId: marketingMessagingCampaign.id,
                  marketingCampaignId:
                    marketingMessagingCampaign.marketingCampaignId,
                  marketingMessagingCampaignShipmentId:
                    newMarketingMessagingCampaignShipment.id,
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
        numberFailed = true;

        result.ok = false;
        console.log("--- Error en send", error);
        result.errors.push(error.message);
        result.numbersWithErrors.push({
          number: numberObj.number,
          error: error.message
        });
      }

      console.log(
        "--- MarketingMessagingCampaignShipmentNumber: ",
        newMarketingMessagingCampaignShipment
      );

      await MarketingMessagingCampaignShipmentNumber.create({
        number: numberObj.number,
        hadError: numberFailed,
        marketingMessagingCampaignShipmentId:
          newMarketingMessagingCampaignShipment.id
      });
    }

    await newMarketingMessagingCampaignShipment.update({
      endTimestamp: (Date.now() / 1000) | 0,
      status: shipmentCanceled ? undefined : "sent"
    });

    await marketingMessagingCampaign.reload();

    emitEvent({
      event: {
        name: "marketingMessagingCampaign",
        data: {
          action: "update",
          marketingMessagingCampaign
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

  const marketingMessagingCampaign = await MarketingMessagingCampaign.findByPk(
    messagingCampaignId,
    {
      include: [
        {
          model: MarketingMessagingCampaignShipment,
          as: "marketingMessagingCampaignShipments",
          order: [["id", "DESC"]],
          required: false,
          separate: true
        }
      ]
    }
  );

  if (
    marketingMessagingCampaign.marketingMessagingCampaignShipments?.[0]
      .status === "sending"
  ) {
    await marketingMessagingCampaign.marketingMessagingCampaignShipments?.[0].update(
      {
        status: "canceled"
      }
    );
  }

  marketingMessagingCampaign.reload();

  emitEvent({
    event: {
      name: "marketingMessagingCampaign",
      data: {
        action: "update",
        marketingMessagingCampaign
      }
    }
  });

  return res.status(200).json(marketingMessagingCampaign);
};
