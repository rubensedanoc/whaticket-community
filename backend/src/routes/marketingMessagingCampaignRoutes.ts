import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as MarketingMessagingCampaignController from "../controllers/MarketingMessagingCampaignController";

const marketingMessagingCampaignRoutes = Router();

marketingMessagingCampaignRoutes.get(
  "/marketingMessagingCampaign/:marketingMessagingCampaignId",
  isAuth,
  MarketingMessagingCampaignController.show
);

marketingMessagingCampaignRoutes.post(
  "/marketingMessagingCampaign",
  isAuth,
  MarketingMessagingCampaignController.store
);

marketingMessagingCampaignRoutes.put(
  "/marketingMessagingCampaign/:marketingMessagingCampaignId",
  isAuth,
  MarketingMessagingCampaignController.update
);

marketingMessagingCampaignRoutes.delete(
  "/marketingMessagingCampaign/:marketingMessagingCampaignId",
  isAuth,
  MarketingMessagingCampaignController.remove
);

// -----

marketingMessagingCampaignRoutes.post(
  "/marketingMessagingCampaign/send",
  isAuth,
  MarketingMessagingCampaignController.send
);

export default marketingMessagingCampaignRoutes;
