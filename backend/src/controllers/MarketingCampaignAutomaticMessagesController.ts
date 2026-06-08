import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import { persistMulterFile } from "../services/StorageService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { marketingCampaignId, marketingMessagingCampaignId } = req.params;
  const where: any = {};
  if (marketingCampaignId) where.marketingCampaignId = marketingCampaignId;
  if (marketingMessagingCampaignId) where.marketingMessagingCampaignId = marketingMessagingCampaignId;
  const messages = await MarketingCampaignAutomaticMessage.findAll({ where, order: [["order", "ASC"]] });
  return res.status(200).json(messages);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { marketingCampaignAutomaticMessageId } = req.params;
  const message = await MarketingCampaignAutomaticMessage.findByPk(marketingCampaignAutomaticMessageId);
  return res.status(200).json(message);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { order, body, mediaType, marketingCampaignId, marketingMessagingCampaignId } = req.body;
  let { templatePayload } = req.body;
  if (typeof templatePayload === "string") templatePayload = JSON.parse(templatePayload);

  if (!templatePayload) throw new AppError("templatePayload is required", 400);

  const medias = req.files as Express.Multer.File[];
  let message;

  if (mediaType !== "text" && medias.length > 0) {
    const media = medias[0];
    if (media.size > 80000000) throw new AppError("El archivo supera el limite de 80MB", 400);
    const storedMediaKey = await persistMulterFile(media, "marketingCampaignAutomaticMessage");
    message = await MarketingCampaignAutomaticMessage.create({
      order, body, mediaType, mediaUrl: storedMediaKey,
      ...(marketingCampaignId && { marketingCampaignId }),
      ...(marketingMessagingCampaignId && { marketingMessagingCampaignId }),
      templatePayload
    });
  } else {
    message = await MarketingCampaignAutomaticMessage.create({
      order, body, mediaType: "text",
      ...(marketingCampaignId && { marketingCampaignId }),
      ...(marketingMessagingCampaignId && { marketingMessagingCampaignId }),
      templatePayload
    });
  }

  emitEvent({ event: { name: "marketingCampaignAutomaticMessage", data: { action: "update", message } } });
  return res.status(200).json(message);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { marketingCampaignAutomaticMessageId } = req.params;
  const { order, body, mediaType, marketingCampaignId } = req.body;
  let { templatePayload } = req.body;
  if (typeof templatePayload === "string") templatePayload = JSON.parse(templatePayload);

  if (!templatePayload) throw new AppError("templatePayload is required", 400);

  let message = await MarketingCampaignAutomaticMessage.findByPk(marketingCampaignAutomaticMessageId);
  const medias = req.files as Express.Multer.File[];

  const updateData: any = { order, body, mediaType, templatePayload };
  if (mediaType !== "text" && medias.length > 0) {
    const media = medias[0];
    if (media.size > 80000000) throw new AppError("El archivo supera el limite de 80MB", 400);
    updateData.mediaUrl = await persistMulterFile(media, "marketingCampaignAutomaticMessage");
  }

  await message.update(updateData);
  emitEvent({ event: { name: "marketingCampaignAutomaticMessage", data: { action: "update", message } } });
  return res.status(200).json(message);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { marketingCampaignAutomaticMessageId } = req.params;
  await MarketingCampaignAutomaticMessage.destroy({ where: { id: marketingCampaignAutomaticMessageId } });
  emitEvent({ event: { name: "marketingCampaignAutomaticMessage", data: { action: "delete", marketingCampaignAutomaticMessageId } } });
  return res.status(200).send();
};
