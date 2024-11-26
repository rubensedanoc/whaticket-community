import { Request, Response } from "express";
import WAWebJS, { MessageMedia, MessageSendOptions } from "whatsapp-web.js";
import AppError from "../errors/AppError";
import formatBody from "../helpers/Mustache";
import { emitEvent } from "../libs/emitEvent";
import { getWbot } from "../libs/wbot";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaign from "../models/MarketingMessagingCampaigns";
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
        }
      ]
    }
  );

  return res.status(200).json(marketingMessagingCampaign);
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
        newMarketingMessagingCampaign
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

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { marketingMessagingCampaignId, whatsappId, numbersToSend } = req.body;

  console.log("--- send: ", req.body);

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
        }
      ]
    }
  );

  if (!marketingMessagingCampaign) {
    throw new AppError("Campaña de mensajes no encontrada", 404);
  }

  for (const number of numbersToSend) {
    try {
      await CheckIsValidContact(number, whatsappId);

      const wbot = getWbot(whatsappId);

      const sentMessages: WAWebJS.Message[] = [];

      for (const messageToSend of marketingMessagingCampaign.marketingCampaignAutomaticMessages) {
        let msg: WAWebJS.Message;

        if (messageToSend.mediaType === "text") {
          let body = formatBody(`\u200e${messageToSend.body}`);

          await new Promise(async (resolve, reject) => {
            try {
              const msg = await wbot.sendMessage(`${number}@c.us`, body);

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
                msgFromMe: msg.fromMe
              });

              await verifyMessage({
                msg,
                ticket,
                contact
              });

              setTimeout(() => {
                resolve(null);
              }, 1000);
            } catch (error) {
              reject(error);
            }
          }).catch(error => {
            result.errors.push(error.message);
            result.numbersWithErrors.push({
              number,
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
                `${number}@c.us`,
                newMedia,
                mediaOptions
              );

              sentMessages.push(msg);

              setTimeout(() => {
                resolve(null);
              }, 1000);
            } catch (error) {
              reject(error);
            }
          }).catch(error => {
            result.errors.push(error.message);
            result.numbersWithErrors.push({
              number,
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
        number,
        error: error.message
      });
    }
  }

  marketingMessagingCampaign.update({
    timesSent: marketingMessagingCampaign.timesSent + 1
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

  return res.status(200).json(result);
};
