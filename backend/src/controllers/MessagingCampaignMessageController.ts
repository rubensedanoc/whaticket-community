import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";
import MessagingCampaignMessage from "../models/MessagingCampaignMessage";
import { persistMulterFile } from "../services/StorageService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { messagingCampaignId } = req.params;
  const marketingCampaign = await MessagingCampaignMessage.findAll({
    where: { messagingCampaignId },
    order: [["order", "ASC"]]
  });
  return res.status(200).json(marketingCampaign);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { messagingCampaignMessageId } = req.params;
  const message = await MessagingCampaignMessage.findByPk(messagingCampaignMessageId);
  return res.status(200).json(message);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { order, body, mediaType, messagingCampaignId } = req.body;
  let { templatePayload } = req.body;

  if (typeof templatePayload === "string") {
    templatePayload = JSON.parse(templatePayload);
  }

  if (!templatePayload) {
    throw new AppError("templatePayload is required", 400);
  }

  const medias = req.files as Express.Multer.File[];
  let messagingCampaignMessage;

  if (mediaType !== "text" && medias.length > 0) {
    const media = medias[0];
    if (media.size > 80000000) throw new AppError("El archivo supera el limite de 80MB", 400);
    const storedMediaKey = await persistMulterFile(media, "messagingCampaignMessage");
    messagingCampaignMessage = await MessagingCampaignMessage.create({
      order, body, mediaType,
      mediaUrl: storedMediaKey,
      messagingCampaignId,
      templatePayload
    });
  } else {
    messagingCampaignMessage = await MessagingCampaignMessage.create({
      order, body, mediaType,
      messagingCampaignId,
      templatePayload
    });
  }

  emitEvent({ event: { name: "messagingCampaignMessage", data: { action: "update", messagingCampaignMessage } } });
  return res.status(200).json(messagingCampaignMessage);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { messagingCampaignMessageId } = req.params;
  const { order, body, mediaType, marketingCampaignId } = req.body;
  let { templatePayload } = req.body;
  if (typeof templatePayload === "string") templatePayload = JSON.parse(templatePayload);

  if (!templatePayload) {
    throw new AppError("templatePayload is required", 400);
  }

  let messagingCampaignMessage = await MessagingCampaignMessage.findByPk(messagingCampaignMessageId);
  const medias = req.files as Express.Multer.File[];

  const updateData: any = { order, body, mediaType, templatePayload };
  if (mediaType !== "text" && medias.length > 0) {
    const media = medias[0];
    if (media.size > 80000000) throw new AppError("El archivo supera el limite de 80MB", 400);
    updateData.mediaUrl = await persistMulterFile(media, "messagingCampaignMessage");
  }

  await messagingCampaignMessage.update(updateData);
  emitEvent({ event: { name: "messagingCampaignMessage", data: { action: "update", messagingCampaignMessage } } });
  return res.status(200).json(messagingCampaignMessage);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { messagingCampaignMessageId } = req.params;
  await MessagingCampaignMessage.destroy({ where: { id: messagingCampaignMessageId } });
  emitEvent({ event: { name: "messagingCampaignMessage", data: { action: "delete", messagingCampaignMessageId } } });
  return res.status(200).send();
};
