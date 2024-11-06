import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as MarketingCampaignsController from "../controllers/MarketingCampaignsController";

const marketingCampaignsRoutes = Router();

marketingCampaignsRoutes.get(
  "/marketingCampaigns",
  isAuth,
  MarketingCampaignsController.index
);

marketingCampaignsRoutes.get(
  "/marketingCampaign/:marketingCampaignId",
  isAuth,
  MarketingCampaignsController.show
);

marketingCampaignsRoutes.post(
  "/marketingCampaign",
  isAuth,
  MarketingCampaignsController.store
);

marketingCampaignsRoutes.put(
  "/marketingCampaign/:marketingCampaignId",
  isAuth,
  MarketingCampaignsController.update
);

marketingCampaignsRoutes.delete(
  "/marketingCampaign/:marketingCampaignId",
  isAuth,
  MarketingCampaignsController.remove
);

export default marketingCampaignsRoutes;
