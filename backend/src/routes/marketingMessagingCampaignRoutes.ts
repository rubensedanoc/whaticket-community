import { Router } from "express";
import isAuth from "../middleware/isAuth";

import multer from "multer";
import uploadConfig from "../config/upload";

import * as MarketingMessagingCampaignController from "../controllers/MarketingMessagingCampaignController";

const marketingMessagingCampaignRoutes = Router();

const upload = multer(uploadConfig);

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
  upload.array("medias"),
  MarketingMessagingCampaignController.send
);

marketingMessagingCampaignRoutes.post(
  "/marketingMessagingCampaign/cancel",
  isAuth,
  MarketingMessagingCampaignController.cancel
);

export default marketingMessagingCampaignRoutes;
