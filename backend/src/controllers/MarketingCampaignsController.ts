import { Request, Response } from "express";
import { emitEvent } from "../libs/emitEvent";
import MarketingCampaign from "../models/MarketingCampaign";
import MarketingCampaignAutomaticMessage from "../models/MarketingCampaignAutomaticMessage";
import MarketingMessagingCampaign from "../models/MarketingMessagingCampaigns";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const marketingCampaigns = await MarketingCampaign.findAll();

  return res.status(200).json(marketingCampaigns);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { marketingCampaignId } = req.params;

  const marketingCampaign = await MarketingCampaign.findByPk(
    marketingCampaignId,
    {
      include: [
        {
          model: MarketingCampaignAutomaticMessage,
          as: "marketingCampaignAutomaticMessages",
          required: false,
          order: [["order", "ASC"]],
          separate: true
        },
        {
          model: MarketingMessagingCampaign,
          as: "marketingMessagingCampaigns",
          required: false
        }
      ]
    }
  );

  return res.status(200).json(marketingCampaign);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, keywords, isActive } = req.body;

  const marketingCampaign = await MarketingCampaign.create({
    name,
    keywords: JSON.stringify(keywords),
    isActive
  });

  emitEvent({
    event: {
      name: "marketingCampaign",
      data: {
        action: "update",
        marketingCampaign
      }
    }
  });

  return res.status(200).json(marketingCampaign);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { marketingCampaignId } = req.params;
  const { name, keywords, isActive } = req.body;

  const marketingCampaign = await MarketingCampaign.findByPk(
    marketingCampaignId
  );

  marketingCampaign.update({
    name,
    keywords: JSON.stringify(keywords),
    isActive
  });

  emitEvent({
    event: {
      name: "marketingCampaign",
      data: {
        action: "update",
        marketingCampaign
      }
    }
  });

  return res.status(201).json(marketingCampaign);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { marketingCampaignId } = req.params;

  const marketingCampaign = await MarketingCampaign.findByPk(
    marketingCampaignId
  );

  marketingCampaign.destroy();

  emitEvent({
    event: {
      name: "marketingCampaign",
      data: {
        action: "delete",
        marketingCampaignId: +marketingCampaignId
      }
    }
  });

  return res.status(200).send();
};
