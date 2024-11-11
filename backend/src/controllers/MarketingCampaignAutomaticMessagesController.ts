import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const marketingCampaignAutomaticMessages =
    await MarketingCampaignAutomaticMessage.findAll({
      order: [["order", "ASC"]]
    });

  return res.status(200).json(marketingCampaignAutomaticMessages);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { marketingCampaignAutomaticMessageId } = req.params;

  const marketingCampaign = await MarketingCampaignAutomaticMessage.findByPk(
    marketingCampaignAutomaticMessageId
  );

  return res.status(200).json(marketingCampaign);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { order, body, mediaType, marketingCampaignId } = req.body;
  const medias = req.files as Express.Multer.File[];

  let marketingCampaignAutomaticMessage;

  if (mediaType !== "text") {
    const media = medias[0];

    if (media.size > 80000000) {
      throw new AppError("Archivo supera el tamaño máximo permitido (80mb)");
    }

    console.log(media);

    marketingCampaignAutomaticMessage =
      await MarketingCampaignAutomaticMessage.create({
        order,
        body,
        mediaType,
        mediaUrl: media.filename,
        marketingCampaignId
      });
  } else {
    marketingCampaignAutomaticMessage =
      await MarketingCampaignAutomaticMessage.create({
        order,
        body,
        mediaType,
        marketingCampaignId
      });
  }

  emitEvent({
    event: {
      name: "marketingCampaignAutomaticMessage",
      data: {
        action: "update",
        marketingCampaignAutomaticMessage
      }
    }
  });

  return res.status(200).json(marketingCampaignAutomaticMessage);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { marketingCampaignAutomaticMessageId } = req.params;
  const { order, body, mediaType, marketingCampaignId } = req.body;
  const medias = req.files as Express.Multer.File[];

  let marketingCampaignAutomaticMessage =
    await MarketingCampaignAutomaticMessage.findByPk(
      marketingCampaignAutomaticMessageId
    );

  if (mediaType !== "text" && medias.length > 0) {
    const media = medias[0];

    if (media.size > 80000000) {
      throw new AppError("Archivo supera el tamaño máximo permitido (80mb)");
    }

    console.log(media);

    marketingCampaignAutomaticMessage.update({
      order,
      body,
      mediaType,
      mediaUrl: media.filename
    });
  } else {
    marketingCampaignAutomaticMessage.update({
      order,
      body,
      mediaType
    });
  }

  emitEvent({
    event: {
      name: "marketingCampaignAutomaticMessage",
      data: {
        action: "update",
        marketingCampaignAutomaticMessage
      }
    }
  });

  return res.status(201).json(marketingCampaignAutomaticMessage);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { marketingCampaignAutomaticMessageId } = req.params;

  const marketingCampaignAutomaticMessage =
    await MarketingCampaignAutomaticMessage.findByPk(
      marketingCampaignAutomaticMessageId
    );

  marketingCampaignAutomaticMessage.destroy();

  emitEvent({
    event: {
      name: "marketingCampaignAutomaticMessage",
      data: {
        action: "delete",
        marketingCampaignAutomaticMessageId:
          +marketingCampaignAutomaticMessageId
      }
    }
  });

  return res.status(200).send();
};
