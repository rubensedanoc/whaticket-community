import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { emitEvent } from "../libs/emitEvent";
import MessagingCampaignMessage from "../models/MessagingCampaignMessage";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const messagingCampaignMessages = await MessagingCampaignMessage.findAll({
    order: [["order", "ASC"]]
  });

  return res.status(200).json(messagingCampaignMessages);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { messagingCampaignMessageId } = req.params;

  const marketingCampaign = await MessagingCampaignMessage.findByPk(
    messagingCampaignMessageId
  );

  return res.status(200).json(marketingCampaign);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { order, body, mediaType, messagingCampaignId } = req.body;

  console.log("--------- store:", req.body);

  const medias = req.files as Express.Multer.File[];

  let messagingCampaignMessage;

  if (mediaType !== "text") {
    const media = medias[0];

    if (media.size > 80000000) {
      throw new AppError("Archivo supera el tamaño máximo permitido (80mb)");
    }

    console.log(media);

    messagingCampaignMessage = await MessagingCampaignMessage.create({
      order,
      body,
      mediaType,
      mediaUrl: media.filename,
      ...(messagingCampaignId ? { messagingCampaignId } : null)
    });
  } else {
    messagingCampaignMessage = await MessagingCampaignMessage.create({
      order,
      body,
      mediaType,
      ...(messagingCampaignId ? { messagingCampaignId } : null)
    });
  }

  emitEvent({
    event: {
      name: "messagingCampaignMessage",
      data: {
        action: "update",
        messagingCampaignMessage
      }
    }
  });

  return res.status(200).json(messagingCampaignMessage);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messagingCampaignMessageId } = req.params;
  const { order, body, mediaType, marketingCampaignId } = req.body;
  const medias = req.files as Express.Multer.File[];

  let messagingCampaignMessage = await MessagingCampaignMessage.findByPk(
    messagingCampaignMessageId
  );

  if (mediaType !== "text" && medias.length > 0) {
    const media = medias[0];

    if (media.size > 80000000) {
      throw new AppError("Archivo supera el tamaño máximo permitido (80mb)");
    }

    console.log(media);

    messagingCampaignMessage.update({
      order,
      body,
      mediaType,
      mediaUrl: media.filename
    });
  } else {
    messagingCampaignMessage.update({
      order,
      body,
      mediaType
    });
  }

  emitEvent({
    event: {
      name: "messagingCampaignMessage",
      data: {
        action: "update",
        messagingCampaignMessage
      }
    }
  });

  return res.status(201).json(messagingCampaignMessage);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messagingCampaignMessageId } = req.params;

  const messagingCampaignMessage = await MessagingCampaignMessage.findByPk(
    messagingCampaignMessageId
  );

  messagingCampaignMessage.destroy();

  emitEvent({
    event: {
      name: "messagingCampaignMessage",
      data: {
        action: "delete",
        messagingCampaignMessageId: +messagingCampaignMessageId
      }
    }
  });

  return res.status(200).send();
};
